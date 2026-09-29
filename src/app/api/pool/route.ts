import { NextResponse } from "next/server";
import {
  EspnApiError,
  fetchAllPropositions,
  fetchAllTiebreaks,
  fetchChallenge,
  fetchGroupPicks,
  fetchLeague,
  fetchPickcenter,
  fetchPredictor,
  fetchScoreboard,
  seasonFromChallenge,
  type RawPickcenter,
  type RawPrediction,
} from "@/lib/espn/client";
import { normalizePool } from "@/lib/espn/normalize";
import type { PoolModel } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Short TTL so a page refresh during a live game sees fresh results without
 * hammering ESPN. Values are held in module scope, which on Vercel means per
 * lambda instance - good enough for a personal dashboard.
 */
const TTL_MS = 60_000;

interface CacheEntry {
  at: number;
  model: PoolModel;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PoolModel>>();

/**
 * Everything is derived from the league id alone.
 *
 * ESPN does not expose a reverse lookup from a league to its challenge through
 * the pick views, but `/apis/v1/groups/{id}` does resolve one, and the numeric
 * challenge id it returns is accepted everywhere the challenge key is. So a
 * league id is the only piece of configuration the app ever needs, and there is
 * no default challenge, season, or league baked in anywhere.
 */
async function loadPool(leagueId: string): Promise<PoolModel> {
  const warnings: string[] = [];

  const challengeId = await fetchLeague(leagueId);
  if (challengeId === null) {
    throw new EspnApiError(
      `ESPN does not recognise "${leagueId}" as a Pick'em league. It should be the group id from the league's URL on espn.com, and the league has to be public.`,
      404,
      leagueId,
    );
  }

  const challenge = await fetchChallenge(challengeId);

  // The rest of the core data. These must all succeed.
  const [archive, tiebreaks, picks] = await Promise.all([
    fetchAllPropositions(challengeId),
    fetchAllTiebreaks(challengeId).catch(() => {
      warnings.push("Tiebreak questions unavailable.");
      return [] as Awaited<ReturnType<typeof fetchAllTiebreaks>>;
    }),
    fetchGroupPicks(challengeId, leagueId),
  ]);

  if (
    picks.data.challengeSettings?.scoringFormatId !== 2 &&
    warnings.length === 0
  ) {
    warnings.push(
      `This group uses the ${picks.data.challengeSettings?.scoringFormatId ?? "?"} scoring format, not Confidence. Confidence-weighted views may not apply.`,
    );
  }

  if (
    picks.entryCount !== null &&
    picks.entryCount !== picks.data.entries.length
  ) {
    warnings.push(
      `ESPN reports ${picks.entryCount} entries but only ${picks.data.entries.length} were returned; this group may need paginated loading.`,
    );
  }

  // Enrichment for the current week. All best-effort.
  const currentWeek = challenge.currentScoringPeriod.id;
  const season = seasonFromChallenge(challenge);
  let scoreboardEvents: Awaited<ReturnType<typeof fetchScoreboard>>["events"] = [];
  if (season !== null) {
    try {
      scoreboardEvents = (await fetchScoreboard(season, currentWeek)).events;
    } catch {
      warnings.push("NFL scoreboard unavailable; live status and records omitted.");
    }
  } else {
    warnings.push("Could not determine the season; live status and odds omitted.");
  }

  const eventIds = [...new Set(scoreboardEvents.map((e) => e.id))];
  const [pickcenters, predictors] = await Promise.all([
    Promise.all(
      eventIds.map(async (id) => [id, await fetchPickcenter(id)] as const),
    ),
    Promise.all(
      eventIds.map(async (id) => [id, await fetchPredictor(id)] as const),
    ),
  ]);

  const pcMap = new Map<string, RawPickcenter>();
  for (const [id, pc] of pickcenters) if (pc) pcMap.set(id, pc);
  const predMap = new Map<string, RawPrediction>();
  for (const [id, p] of predictors) if (p) predMap.set(id, p);
  if (eventIds.length > 0 && pcMap.size === 0) {
    warnings.push("Betting lines unavailable from ESPN right now.");
  }

  return normalizePool({
    challenge,
    archive,
    tiebreaks,
    group: picks.data,
    scoreboardEvents,
    pickcenters: pcMap,
    predictors: predMap,
    warnings,
    espnEntryCount: picks.entryCount,
    requestedGroupId: leagueId,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const leagueId = url.searchParams.get("league")?.trim() ?? "";

  if (!leagueId) {
    return NextResponse.json(
      {
        error:
          "No league requested. Pass ?league=<id> — it is the group id from the league's URL on espn.com.",
      },
      { status: 400 },
    );
  }

  const now = Date.now();
  const hit = cache.get(leagueId);
  if (hit && now - hit.at < TTL_MS) {
    return NextResponse.json(hit.model, {
      headers: { "x-cache": "HIT", "cache-control": "no-store" },
    });
  }

  try {
    let promise = inFlight.get(leagueId);
    if (!promise) {
      promise = loadPool(leagueId).finally(() => {
        inFlight.delete(leagueId);
      });
      inFlight.set(leagueId, promise);
    }
    const model = await promise;
    cache.set(leagueId, { at: Date.now(), model });
    return NextResponse.json(model, {
      headers: { "x-cache": "MISS", "cache-control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof EspnApiError ? error.status : 502;
    const message =
      error instanceof Error ? error.message : "Unknown error fetching pool data";
    return NextResponse.json({ error: message }, { status });
  }
}
