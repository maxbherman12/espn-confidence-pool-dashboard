import { NextResponse } from "next/server";
import { EspnApiError, fetchChallenges, searchGroups } from "@/lib/espn/client";

export const dynamic = "force-dynamic";

export interface GroupHit {
  id: string;
  name: string;
  size: number;
  creator: string | null;
  logo: string | null;
  confidence: boolean;
}

export interface GroupSearchResult {
  groups: GroupHit[];
  total: number;
}

/** NFL Pick'em challenge keys: `nfl-pickem-2026`, and `nfl-pigskin-pickem-2025` before that. */
const NFL_PICKEM = /^nfl-(?:pigskin-)?pickem-(\d{4})$/;

let current: { at: number; id: number } | null = null;

/**
 * The NFL Pick'em challenge to search in: the live one, or the latest one
 * between seasons. Looked up rather than hard-coded so it rolls over each
 * year. Cached for an hour per instance.
 */
async function currentChallenge(): Promise<number> {
  if (current && Date.now() - current.at < 3_600_000) return current.id;
  const all = (await fetchChallenges()).filter((c) => NFL_PICKEM.test(c.key));
  if (!all.length) throw new EspnApiError("ESPN has no NFL Pick'em game right now.", 404, "challenges");
  const pick = all.find((c) => c.active) ?? all.reduce((a, b) => (b.id > a.id ? b : a));
  current = { at: Date.now(), id: pick.id };
  return pick.id;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ groups: [], total: 0 } satisfies GroupSearchResult);
  }
  try {
    const { groups, total } = await searchGroups(await currentChallenge(), q.slice(0, 60));
    const body: GroupSearchResult = {
      total: total ?? groups.length,
      groups: groups.map((g) => ({
        id: g.groupId,
        name: g.groupSettings.name?.trim() || "Unnamed group",
        size: g.size,
        creator: g.groupSettings.creatorMember?.displayName ?? null,
        logo: g.groupSettings.logo ?? null,
        confidence: g.challengeSettings?.scoringFormatId === 2,
      })),
    };
    return NextResponse.json(body, {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    const status = error instanceof EspnApiError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status });
  }
}
