import {
  SCORING_FORMAT_LABELS,
  type EntryPick,
  type Outcome,
  type PoolEntry,
  type PoolGame,
  type PoolMeta,
  type PoolModel,
  type PoolTiebreak,
  type PoolWeek,
  type WeekStatus,
} from "@/lib/types";
import {
  impliedWinProbabilities,
  predictionWinProb,
  teamIdFromRef,
  type RawChallenge,
  type RawGroup,
  type RawPickcenter,
  type RawPrediction,
  type RawProposition,
  type RawScoreboardEvent,
  type RawTiebreak,
} from "./client";

function mappingValue(
  mappings: { type: string; value: string }[] | undefined,
  type: string,
): string | null {
  const hit = mappings?.find((m) => m.type === type);
  return hit?.value ?? null;
}

function scoreboardTeamIdByEventId(
  events: RawScoreboardEvent[],
): Map<string, Map<string, RawScoreboardEvent["competitions"][0]["competitors"][0]>> {
  const byEvent = new Map<
    string,
    Map<
      string,
      RawScoreboardEvent["competitions"][0]["competitors"][0]
    >
  >();
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const m = new Map<
      string,
      RawScoreboardEvent["competitions"][0]["competitors"][0]
    >();
    for (const c of comp.competitors) m.set(c.id, c);
    byEvent.set(ev.id, m);
  }
  return byEvent;
}

function logoFor(competitor: {
  logos: { rel: string[]; href: string }[];
}): string | null {
  return (
    competitor.logos.find((l) => l.rel.includes("full"))?.href ??
    competitor.logos.find((l) => l.rel.includes("default"))?.href ??
    competitor.logos[0]?.href ??
    null
  );
}

function toOutcome(
  raw: RawProposition["possibleOutcomes"][number],
  scoringFormatId: number,
  sbTeams: Map<string, RawScoreboardEvent["competitions"][0]["competitors"][0]> | undefined,
  pickcenter: RawPickcenter | null,
  predictor: RawPrediction | null,
): Outcome {
  const teamId = mappingValue(raw.mappings, "COMPETITOR_ID");
  const sb = teamId && sbTeams ? sbTeams.get(teamId) : undefined;
  const moneyline =
    pickcenter && teamId
      ? (pickcenter.awayTeamOdds.teamId === teamId
          ? pickcenter.awayTeamOdds.moneyLine
          : pickcenter.homeTeamOdds.teamId === teamId
            ? pickcenter.homeTeamOdds.moneyLine
            : null)
      : null;

  // The predictor identifies teams by core-API `$ref`, while Pick'em identifies
  // them by the `COMPETITOR_ID` mapping. Both are ESPN core team ids.
  let bpiWinProb: number | null = null;
  if (predictor && teamId) {
    const home = teamIdFromRef(predictor.homeTeam?.team?.$ref);
    const away = teamIdFromRef(predictor.awayTeam?.team?.$ref);
    const side =
      teamId === away
        ? predictor.awayTeam
        : teamId === home
          ? predictor.homeTeam
          : undefined;
    bpiWinProb = predictionWinProb(side);
  }

  const counter = raw.choiceCounters?.find(
    (c) => c.scoringFormatId === scoringFormatId,
  );

  return {
    outcomeId: raw.id,
    abbrev: raw.abbrev,
    name: raw.description || raw.name,
    teamId,
    homeAway: raw.subType === "AWAY" ? "away" : raw.subType === "HOME" ? "home" : null,
    logo: mappingValue(raw.mappings, "IMAGE_PRIMARY") ?? (sb ? logoFor(sb.team) : null),
    color: mappingValue(raw.mappings, "COLOR_PRIMARY") ?? sb?.team.color ?? null,
    score: typeof raw.score === "number" ? raw.score : null,
    moneyline: typeof moneyline === "number" ? moneyline : null,
    bpiWinProb,
    national: counter
      ? { count: counter.count, pct: counter.percentage * 100 }
      : null,
    record: raw.additionalInfo?.trim() || null,
  };
}

function toWeekStatus(
  period: {
    id: number;
    allPropositionsLocked: boolean;
  },
  allWeeksComplete: boolean,
  currentWeek: number,
): WeekStatus {
  if (period.id < currentWeek) return "COMPLETE";
  if (period.id > currentWeek) return "FUTURE";
  return allWeeksComplete ? "COMPLETE" : "IN_PROGRESS";
}

export interface NormalizeInput {
  challenge: RawChallenge;
  /** Season-wide proposition archive, keyed by id. */
  archive: RawProposition[];
  tiebreaks: RawTiebreak[];
  group: RawGroup;
  /** Current-week scoreboard, for live status / records / weather. */
  scoreboardEvents: RawScoreboardEvent[];
  pickcenters: Map<string, RawPickcenter>;
  predictors: Map<string, RawPrediction>;
  warnings: string[];
  espnEntryCount: number | null;
  requestedGroupId: string;
}

/**
 * Turns the raw upstream payloads into the single normalized model the UI
 * consumes. Pure and synchronous so it can be unit tested against fixtures.
 */
export function normalizePool(input: NormalizeInput): PoolModel {
  const {
    challenge,
    archive,
    tiebreaks,
    group,
    scoreboardEvents,
    pickcenters,
    predictors,
    warnings,
    espnEntryCount,
    requestedGroupId,
  } = input;

  const scoringFormatId = group.challengeSettings?.scoringFormatId ?? 1;
  const currentWeek = challenge.currentScoringPeriod.id;
  const sbByEvent = scoreboardTeamIdByEventId(scoreboardEvents);

  // Prefer the challenge payload (freshest) but fall back to the archive so
  // every game in the season is present.
  const propositionsById = new Map<string, RawProposition>();
  for (const p of archive) propositionsById.set(p.id, p);
  for (const p of challenge.propositions ?? []) propositionsById.set(p.id, p);

  const allPropsComplete = (challenge.propositions ?? []).every(
    (p) => p.correctOutcomes.length > 0,
  );

  const games: PoolGame[] = [];
  for (const raw of propositionsById.values()) {
    const week = raw.scoringPeriodId;
    const eventId = mappingValue(raw.mappings, "EVENT_ID");
    const sbEvent = eventId
      ? scoreboardEvents.find((e) => e.id === eventId)
      : undefined;
    const sbTeams = eventId ? sbByEvent.get(eventId) : undefined;
    const pc = eventId ? (pickcenters.get(eventId) ?? null) : null;
    const pred = eventId ? (predictors.get(eventId) ?? null) : null;

    const outcomes = raw.possibleOutcomes.map((o) =>
      toOutcome(o, scoringFormatId, sbTeams, pc, pred),
    );

    const complete = raw.correctOutcomes.length > 0;
    const inProgress =
      sbEvent?.status?.type?.state === "in" ||
      sbEvent?.status?.type?.completed === false;

    let status: PoolGame["status"] = "PENDING";
    let statusDetail: string | null = null;
    if (complete) {
      status = "COMPLETE";
    } else if (inProgress) {
      status = "IN_PROGRESS";
      statusDetail = sbEvent?.status?.type?.detail ?? null;
    }

    // Fall back to the scoreboard when the outcome is missing a score.
    if (sbTeams) {
      for (const o of outcomes) {
        if (o.score === null && o.teamId && sbTeams.has(o.teamId)) {
          const c = sbTeams.get(o.teamId)!;
          const n = Number(c.score);
          if (!Number.isNaN(n)) o.score = n;
        }
      }
    }

    const moneylines: { [id: string]: number | null } = {};
    for (const o of outcomes) moneylines[o.outcomeId] = o.moneyline;

    games.push({
      propId: raw.id,
      week,
      order: raw.displayOrder,
      name: raw.name,
      description: raw.description,
      eventId,
      status,
      statusDetail,
      correctOutcomeIds: raw.correctOutcomes ?? [],
      outcomes,
      spread: pc?.spread ?? null,
      overUnder: pc?.overUnder ?? null,
      impliedWinProb: impliedWinProbabilities(moneylines),
    });
  }
  games.sort((a, b) => a.week - b.week || a.order - b.order);

  const gamesPerWeek = new Map<number, number>();
  for (const g of games) {
    gamesPerWeek.set(g.week, (gamesPerWeek.get(g.week) ?? 0) + 1);
  }

  const propToWeek = new Map(games.map((g) => [g.propId, g.week]));

  // ---- entries -------------------------------------------------------
  const entries: PoolEntry[] = group.entries.map((e) => {
    const picks: EntryPick[] = [];
    const perWeekPicks = new Map<number, number>();
    for (const p of e.picks ?? []) {
      const outcome = p.outcomesPicked?.[0];
      if (!outcome) continue;
      const week = propToWeek.get(p.propositionId);
      if (week === undefined) continue;
      picks.push({
        propId: p.propositionId,
        week,
        outcomeId: outcome.outcomeId,
        confidence: p.confidenceScore ?? 1,
        result: outcome.result,
      });
      perWeekPicks.set(week, (perWeekPicks.get(week) ?? 0) + 1);
    }

    const byWeek: PoolEntry["espn"]["byWeek"] = {};
    for (const [k, v] of Object.entries(e.score?.scoreByPeriod ?? {})) {
      byWeek[k] = {
        score: v.score,
        wins: v.record?.wins ?? 0,
        losses: v.record?.losses ?? 0,
        possiblePointsMax: v.possiblePointsMax,
      };
    }

    // An entry is "incomplete" if any week it has started is missing picks.
    const incomplete = [...perWeekPicks.entries()].some(
      ([week, n]) => week <= currentWeek && n < (gamesPerWeek.get(week) ?? n),
    );

    return {
      entryId: e.id,
      memberId: e.member?.id ?? "",
      displayName: e.member?.displayName ?? "Unknown",
      entryName: e.name ?? "",
      espn: {
        overallScore: e.score?.overallScore ?? 0,
        rank: e.score?.rank ?? 0,
        sortRank: e.score?.sortRank ?? 0,
        percentile: e.score?.percentile ?? 0,
        possiblePointsMax: e.score?.possiblePointsMax ?? 0,
        record: e.score?.record ?? { wins: 0, losses: 0, ties: 0 },
        byWeek,
      },
      tiebreakAnswers: (e.tiebreakAnswers ?? [])
        .filter((t) => typeof t.answer === "number")
        .map((t) => ({ questionId: t.tiebreakQuestionId, answer: t.answer })),
      picks,
      incomplete,
    };
  });

  // ---- weeks ---------------------------------------------------------
  const weeks: PoolWeek[] = challenge.scoringPeriods
    .map<PoolWeek>((sp) => {
      const count = gamesPerWeek.get(sp.id) ?? 0;
      return {
        id: sp.id,
        label: sp.label,
        abbrev: sp.abbrev,
        subLabel: sp.subLabel,
        startDate: sp.startDate,
        endDate: sp.endDate,
        lockDate: sp.firstPropositionLockDate,
        gameCount: count,
        status: toWeekStatus(
          { id: sp.id, allPropositionsLocked: sp.allPropositionsLocked },
          allPropsComplete,
          currentWeek,
        ),
      };
    })
    .sort((a, b) => a.id - b.id);

  const normalizedTiebreaks: PoolTiebreak[] = tiebreaks
    .filter((t) => t.display !== false)
    .map((t) => ({
      questionId: t.id,
      week: t.scoringPeriodId,
      question: t.question,
      status: t.status,
      overall: !!t.overall,
    }));

  const meta: PoolMeta = {
    requestedGroupId,
    challengeKey: challenge.key,
    challengeId: challenge.id,
    challengeName: challenge.name,
    groupId: group.groupId,
    groupName: group.groupSettings?.name ?? "Group",
    groupSize: group.size ?? entries.length,
    scoringFormatId,
    scoringFormatLabel: SCORING_FORMAT_LABELS[scoringFormatId] ?? "Unknown",
    adminMemberId: group.groupSettings?.adminMemberIds?.[0] ?? null,
    currentWeek,
    weeks,
    tiebreaks: normalizedTiebreaks,
    warnings,
    espnEntryCount,
    fetchedAt: Date.now(),
  };

  return { meta, entries, games };
}
