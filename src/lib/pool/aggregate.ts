import { entryLabel } from "@/lib/name";
import type {
  EntryPick,
  GameAgg,
  OutcomeAgg,
  PoolEntry,
  PoolGame,
  PoolModel,
  WeekAgg,
} from "@/lib/types";

/**
 * Floor for the shared confidence ladder. ESPN's confidence format runs 1..16;
 * using it as the minimum keeps every game's histogram the same width even when
 * the group has not used the top values yet.
 */
const CONFIDENCE_LADDER_MIN = 16;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Index entries by id and every pick by `propId` for fast lookups. */
export interface PoolIndex {
  entriesById: Map<string, PoolEntry>;
  /** entryId -> propId -> pick */
  picksByEntry: Map<string, Map<string, PoolEntry["picks"][number]>>;
  gamesById: Map<string, PoolGame>;
  gamesByWeek: Map<number, PoolGame[]>;
  /** propId -> week */
  weekByProp: Map<string, number>;
  /**
   * Top of the confidence ladder for the whole pool, so every game shares one
   * x-axis. Derived from the pool rather than hardcoded, and floored at 16 (the
   * ESPN confidence format's full range) so a quiet game does not render a
   * short axis next to a long one.
   */
  ladderTop: number;
  entries: PoolEntry[];
  games: PoolGame[];
}

export function indexPool(pool: PoolModel): PoolIndex {
  const entriesById = new Map(pool.entries.map((e) => [e.entryId, e]));
  const picksByEntry = new Map<string, Map<string, PoolEntry["picks"][number]>>();
  for (const e of pool.entries) {
    const m = new Map<string, PoolEntry["picks"][number]>();
    for (const p of e.picks) m.set(p.propId, p);
    picksByEntry.set(e.entryId, m);
  }
  const gamesById = new Map(pool.games.map((g) => [g.propId, g]));
  const gamesByWeek = new Map<number, PoolGame[]>();
  for (const g of pool.games) {
    const arr = gamesByWeek.get(g.week);
    if (arr) arr.push(g);
    else gamesByWeek.set(g.week, [g]);
  }
  for (const arr of gamesByWeek.values()) arr.sort((a, b) => a.order - b.order);

  let observedTop = 0;
  for (const e of pool.entries) {
    for (const p of e.picks) {
      if (p.confidence > observedTop) observedTop = p.confidence;
    }
  }

  return {
    entriesById,
    picksByEntry,
    gamesById,
    gamesByWeek,
    weekByProp: new Map(pool.games.map((g) => [g.propId, g.week])),
    ladderTop: Math.max(CONFIDENCE_LADDER_MIN, observedTop),
    entries: pool.entries,
    games: pool.games,
  };
}

/**
 * Aggregates a single game: who picked what, how much confidence is riding on
 * each side, and how the group lines up with the national pool.
 */
export function aggregateGame(game: PoolGame, index: PoolIndex): GameAgg {
  const counts = new Map<string, number>();
  const confPoints = new Map<string, number>();
  const confidences = new Map<string, number[]>();
  const correctEntries = new Map<string, string[]>();
  const atStake = new Map<string, number>();
  const entryPicks = new Map<
    string,
    { entryId: string; confidence: number; result: EntryPick["result"] }[]
  >();

  let respondents = 0;
  for (const entry of index.entries) {
    const pick = index.picksByEntry.get(entry.entryId)?.get(game.propId);
    if (!pick) continue;
    respondents += 1;
    const id = pick.outcomeId;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    confPoints.set(id, (confPoints.get(id) ?? 0) + pick.confidence);
    const arr = confidences.get(id);
    if (arr) arr.push(pick.confidence);
    else confidences.set(id, [pick.confidence]);
    atStake.set(id, (atStake.get(id) ?? 0) + pick.confidence);
    const rows = entryPicks.get(id);
    const row = { entryId: entry.entryId, confidence: pick.confidence, result: pick.result };
    if (rows) rows.push(row);
    else entryPicks.set(id, [row]);
    if (pick.result === "CORRECT") {
      const arr = correctEntries.get(id);
      if (arr) arr.push(entry.entryId);
      else correctEntries.set(id, [entry.entryId]);
    }
  }

  const totalConfidencePoints = [...confPoints.values()].reduce((a, b) => a + b, 0);

  const byOutcome: OutcomeAgg[] = game.outcomes.map((outcome) => {
    const picks = counts.get(outcome.outcomeId) ?? 0;
    const confidencePoints = confPoints.get(outcome.outcomeId) ?? 0;
    const list = confidences.get(outcome.outcomeId) ?? [];
    const nationalShare = outcome.national ? outcome.national.pct : null;
    const correct = correctEntries.get(outcome.outcomeId) ?? [];
    const pickers = entryPicks
      .get(outcome.outcomeId)
      ?.map(({ entryId, confidence, result }) => {
        const e = index.entriesById.get(entryId);
        return {
          entryId,
          displayName: e?.displayName ?? entryId,
          entryName: e?.entryName ?? "",
          confidence,
          result,
        };
      })
      .sort(
        (a, b) =>
          b.confidence - a.confidence ||
          entryLabel(a.entryName, a.displayName).localeCompare(entryLabel(b.entryName, b.displayName)),
      )
      ?? [];
    return {
      outcome,
      picks,
      share: respondents ? picks / respondents : 0,
      confidencePoints,
      avgConfidence: picks ? confidencePoints / picks : 0,
      medianConfidence: median(list),
      confidenceShare: totalConfidencePoints
        ? (confidencePoints / totalConfidencePoints) * 100
        : 0,
      nationalShare,
      edge: nationalShare === null ? null : picks / (respondents || 1) * 100 - nationalShare,
      correctRate: picks ? correct.length / picks : 0,
      correctEntries: correct,
      pickers,
    };
  });

  // Highest value this game's pickers actually used. Kept separate from the
  // axis top: the histogram spans the full shared ladder so charts line up, but
  // this stays meaningful as "the group never went above n".
  const maxConfidence = Math.max(
    0,
    ...[...confidences.values()].flat().map((c) => c),
  );

  const undecided = game.correctOutcomeIds.length === 0;
  const pointsAtStake: GameAgg["pointsAtStake"] = {};
  const cashRate: GameAgg["cashRate"] = {};
  for (const o of game.outcomes) {
    pointsAtStake[o.outcomeId] = undecided ? null : (atStake.get(o.outcomeId) ?? 0);
    cashRate[o.outcomeId] = undecided
      ? null
      : (correctEntries.get(o.outcomeId)?.length ?? 0) / (respondents || 1);
  }

  // Histogram across the pool-wide ladder (1..ladderTop) rather than this game's
  // observed max, so every game in the list has the same x-axis and the shapes
  // are comparable at a glance.
  const ladderTop = index.ladderTop;
  const histogram: GameAgg["histogram"] = [];
  for (let c = 1; c <= ladderTop; c += 1) {
    const countsByOutcome: Record<string, number> = {};
    for (const [outcomeId, list] of confidences) {
      const n = list.filter((v) => v === c).length;
      if (n > 0) countsByOutcome[outcomeId] = n;
    }
    histogram.push({ confidence: c, counts: countsByOutcome });
  }

  return {
    game,
    respondents,
    missed: index.entries.length - respondents,
    maxConfidence,
    ladderTop,
    totalConfidencePoints,
    byOutcome,
    histogram,
    undecided,
    pointsAtStake,
    cashRate,
  };
}

export function aggregateWeek(week: number, index: PoolIndex): WeekAgg {
  const games = (index.gamesByWeek.get(week) ?? []).map((g) =>
    aggregateGame(g, index),
  );
  const entryCount = index.entries.length;
  const scored = index.entries.map(
    (e) => e.espn.byWeek[String(week)]?.score ?? 0,
  );
  return {
    week,
    games,
    respondents: index.entries.length,
    entryCount,
    avgScore: scored.length
      ? scored.reduce((a, b) => a + b, 0) / scored.length
      : 0,
  };
}

export function aggregateSeason(index: PoolIndex): GameAgg[] {
  return index.games.map((g) => aggregateGame(g, index));
}
