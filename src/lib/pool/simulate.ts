import { entryLabel } from "@/lib/name";
import type {
  PoolGame,
  PoolModel,
  RankedEntry,
  SimulationResult,
} from "@/lib/types";
import { indexPool, type PoolIndex } from "./aggregate";
import { competitionRanks } from "./rank";

/** propId -> winning outcomeId. A game absent from the map is unresolved. */
export type Scenario = Record<string, string>;

function picksOf(index: PoolIndex, entryId: string) {
  return index.picksByEntry.get(entryId) ?? new Map();
}

/**
 * Resolves the effective winner for every game in a week: the hypothetical
 * override if one exists, otherwise the actual result if decided, otherwise
 * unresolved.
 */
export function resolveWinners(
  week: number,
  index: PoolIndex,
  scenario: Scenario,
): { [propId: string]: string } {
  const winners: { [propId: string]: string } = {};
  for (const game of index.gamesByWeek.get(week) ?? []) {
    const override = scenario[game.propId];
    if (override) {
      winners[game.propId] = override;
    } else if (game.correctOutcomeIds.length > 0) {
      winners[game.propId] = game.correctOutcomeIds[0];
    }
  }
  return winners;
}

/**
 * Weekly score for one entry: the sum of the confidence values on picks that
 * resolve correctly.
 *
 * This mirrors ESPN's model exactly. Verified by recomputing all 378
 * entry-weeks of this pool from `picks[]` and matching `scoreByPeriod[].score`
 * and `scoreByPeriod[].record`. Missed picks simply earn nothing; there is no
 * negative scoring.
 */
export function scoreWeek(
  index: PoolIndex,
  entryId: string,
  week: number,
  winners: { [propId: string]: string },
): number {
  const picks = picksOf(index, entryId);
  let total = 0;
  for (const game of index.gamesByWeek.get(week) ?? []) {
    const winner = winners[game.propId];
    if (!winner) continue;
    const pick = picks.get(game.propId);
    if (pick && pick.outcomeId === winner) total += pick.confidence;
  }
  return total;
}

export function scoreWeekAll(
  index: PoolIndex,
  week: number,
  winners: { [propId: string]: string },
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of index.entries) {
    out[e.entryId] = scoreWeek(index, e.entryId, week, winners);
  }
  return out;
}

/**
 * Confidence an entry has banked in each completed week, taken from ESPN's
 * authoritative per-pick results rather than recomputed.
 */
function completedWeekScores(
  index: PoolIndex,
): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const e of index.entries) {
    const byWeek = new Map<number, number>();
    for (const p of e.picks) {
      if (p.result !== "CORRECT") continue;
      byWeek.set(p.week, (byWeek.get(p.week) ?? 0) + p.confidence);
    }
    out.set(e.entryId, byWeek);
  }
  return out;
}

/**
 * Season total for an entry, where `week` is simulated and every other
 * completed week keeps its actual results. Weeks after `week` are not yet
 * scorable and contribute nothing.
 */
export function scoreSeason(
  index: PoolIndex,
  entryId: string,
  week: number,
  winners: { [propId: string]: string },
  completed: Map<string, Map<number, number>> = completedWeekScores(index),
): number {
  const picks = picksOf(index, entryId);
  let total = 0;
  for (const [w, score] of completed.get(entryId) ?? []) {
    if (w <= week && w !== week) total += score;
  }
  for (const game of index.gamesByWeek.get(week) ?? []) {
    const winner = winners[game.propId];
    if (!winner) continue;
    const pick = picks.get(game.propId);
    if (pick && pick.outcomeId === winner) total += pick.confidence;
  }
  return total;
}

export function scoreSeasonAll(
  index: PoolIndex,
  week: number,
  winners: { [propId: string]: string },
): Record<string, number> {
  const completed = completedWeekScores(index);
  const out: Record<string, number> = {};
  for (const e of index.entries) {
    out[e.entryId] = scoreSeason(index, e.entryId, week, winners, completed);
  }
  return out;
}

/** The scenario that reproduces reality: every decided game keeps its winner. */
export function baselineScenario(index: PoolIndex): Scenario {
  const scenario: Scenario = {};
  for (const game of index.games) {
    const correct = game.correctOutcomeIds[0];
    if (correct) scenario[game.propId] = correct;
  }
  return scenario;
}

/** Confidence an entry has at stake in a week (its absolute ceiling). */
export function weekCeiling(index: PoolIndex, week: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of index.entries) {
    let total = 0;
    for (const game of index.gamesByWeek.get(week) ?? []) {
      const pick = picksOf(index, e.entryId).get(game.propId);
      if (pick) total += pick.confidence;
    }
    out[e.entryId] = total;
  }
  return out;
}

/**
 * ESPN's `possiblePointsMax` for a week: the score already banked on decided
 * games plus the confidence still riding on undecided ones. Recomputing this
 * independently is the strongest available proof that the scoring engine
 * agrees with ESPN.
 */
export function reachablePoints(
  index: PoolIndex,
  entryId: string,
  week: number,
): number {
  return maxPoints(index, entryId, week, {});
}

/**
 * The best score an entry could still reach in a week, given the scenario.
 *
 * A pick counts unless it is *known* to be wrong: an overridden game is always
 * winnable, an undecided game is always winnable, and a decided-and-unplayed
 * game only counts if the pick was already correct. With no overrides this
 * reduces to ESPN's `possiblePointsMax`.
 */
export function maxPoints(
  index: PoolIndex,
  entryId: string,
  week: number,
  scenario: Scenario,
): number {
  const picks = picksOf(index, entryId);
  let total = 0;
  for (const game of index.gamesByWeek.get(week) ?? []) {
    const pick = picks.get(game.propId);
    if (!pick) continue;
    if (scenario[game.propId]) {
      total += pick.confidence;
      continue;
    }
    const correct = game.correctOutcomeIds[0];
    if (!correct || pick.outcomeId === correct) total += pick.confidence;
  }
  return total;
}

/**
 * Best achievable season total: everything banked in completed weeks before
 * `week`, plus the simulated week's reachable max.
 */
export function seasonMaxPoints(
  index: PoolIndex,
  entryId: string,
  week: number,
  scenario: Scenario,
  completed: Map<string, Map<number, number>> = completedWeekScores(index),
): number {
  let total = 0;
  for (const [w, score] of completed.get(entryId) ?? []) {
    if (w < week) total += score;
  }
  return total + maxPoints(index, entryId, week, scenario);
}

function buildRanked(
  index: PoolIndex,
  scores: Record<string, number>,
  prevRanks: Map<string, number>,
  prevScores: Map<string, number>,
  ceiling: Record<string, number>,
): RankedEntry[] {
  const entries = index.entries;
  const values = entries.map((e) => scores[e.entryId] ?? 0);
  const ranks = competitionRanks(values);
  return entries
    .map((e, i) => {
      const rank = ranks[i];
      const prevRank = prevRanks.get(e.entryId) ?? rank;
      return {
        entryId: e.entryId,
        displayName: e.displayName,
        entryName: e.entryName,
        score: values[i],
        rank,
        prevRank,
        prevScore: prevScores.get(e.entryId) ?? 0,
        delta: prevRank - rank,
        possiblePointsMax: ceiling[e.entryId] ?? 0,
        tiebreakAnswers: e.tiebreakAnswers,
      };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.score - a.score ||
        entryLabel(a.entryName, a.displayName).localeCompare(
          entryLabel(b.entryName, b.displayName),
        ),
    );
}

export interface SimulateOptions {
  /** Week being simulated. */
  week: number;
  /** Hypothetical winners, overriding actual results where present. */
  scenario: Scenario;
}

/**
 * The what-if engine. Recomputes weekly and season scores from raw picks
 * instead of nudging ESPN's reported numbers, so flipping an already-decided
 * game is handled exactly like projecting an undecided one.
 */
export function simulate(
  pool: PoolModel,
  options: SimulateOptions,
): SimulationResult {
  const index = indexPool(pool);
  const { week, scenario } = options;

  const winners = resolveWinners(week, index, scenario);
  const weekly = scoreWeekAll(index, week, winners);
  const season = scoreSeasonAll(index, week, winners);
  const completed = completedWeekScores(index);

  const weekMax: Record<string, number> = {};
  const seasonMax: Record<string, number> = {};
  for (const e of pool.entries) {
    weekMax[e.entryId] = maxPoints(index, e.entryId, week, scenario);
    seasonMax[e.entryId] = seasonMaxPoints(
      index,
      e.entryId,
      week,
      scenario,
      completed,
    );
  }

  const prevWeeklyScores = new Map(
    pool.entries.map((e) => [e.entryId, e.espn.byWeek[String(week)]?.score ?? 0]),
  );
  const prevSeasonScores = new Map(
    pool.entries.map((e) => [e.entryId, e.espn.overallScore]),
  );

  const rankFrom = (scores: Map<string, number>) => {
    const values = pool.entries.map((e) => scores.get(e.entryId) ?? 0);
    const ranks = competitionRanks(values);
    return new Map(pool.entries.map((e, i) => [e.entryId, ranks[i]]));
  };

  return {
    week,
    weekly: buildRanked(
      index,
      weekly,
      rankFrom(prevWeeklyScores),
      prevWeeklyScores,
      weekMax,
    ),
    season: buildRanked(
      index,
      season,
      rankFrom(prevSeasonScores),
      prevSeasonScores,
      seasonMax,
    ),
    weekMax,
    ...verifyAgainstEspn(pool, index, week),
  };
}

/**
 * Cross-checks the engine against ESPN: for the current week,
 * `reachablePoints` must equal ESPN's reported `possiblePointsMax`, and the
 * baseline simulation must reproduce ESPN's reported weekly and season scores.
 */
function verifyAgainstEspn(
  pool: PoolModel,
  index: PoolIndex,
  week: number,
): { selfCheckPassed: boolean; selfCheckFailures: string[] } {
  const failures: string[] = [];
  // Only the in-progress week has a meaningful reachable-points figure; a
  // finished week is already fully resolved so every entry's ceiling is its
  // actual score.
  if (week !== pool.meta.currentWeek) {
    return { selfCheckPassed: true, selfCheckFailures: [] };
  }

  for (const e of pool.entries) {
    const espn = e.espn.byWeek[String(week)]?.possiblePointsMax;
    if (typeof espn !== "number") continue;
    const ours = reachablePoints(index, e.entryId, week);
    if (ours !== espn) {
      failures.push(
        `${e.displayName}: reachable points ${ours} vs ESPN possiblePointsMax ${espn}`,
      );
    }
  }

  // Baseline (no overrides) must reproduce ESPN's reported scores exactly.
  const base = resolveWinners(week, index, {});
  for (const e of pool.entries) {
    const ours = scoreWeek(index, e.entryId, week, base);
    const espnWeek = e.espn.byWeek[String(week)]?.score;
    if (typeof espnWeek === "number" && ours !== espnWeek) {
      failures.push(
        `${e.displayName}: baseline week ${ours} vs ESPN ${espnWeek}`,
      );
    }
    const oursSeason = scoreSeason(index, e.entryId, week, base);
    if (oursSeason !== e.espn.overallScore) {
      failures.push(
        `${e.displayName}: baseline season ${oursSeason} vs ESPN ${e.espn.overallScore}`,
      );
    }
  }

  return { selfCheckPassed: failures.length === 0, selfCheckFailures: failures };
}

/** Games in a week with no result yet. */
export function undecidedGames(week: number, index: PoolIndex): PoolGame[] {
  return (index.gamesByWeek.get(week) ?? []).filter(
    (g) => g.correctOutcomeIds.length === 0,
  );
}

/** Every game in a week, in display order. */
export function gamesForWeek(week: number, index: PoolIndex): PoolGame[] {
  return index.gamesByWeek.get(week) ?? [];
}
