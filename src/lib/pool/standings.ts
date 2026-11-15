import type { PoolEntry, PoolModel } from "@/lib/types";
import type { PoolIndex } from "./aggregate";
import { weekLadderTotal, weekPossibleMax } from "./possible";
import { competitionRanks } from "./rank";

export interface StandingRow {
  entryId: string;
  rank: number;
  /** Season total through the chosen week, or the week score in week mode. */
  value: number;
  /** Points behind first place on `value`. */
  back: number;
  weekScore: number;
  /** Whole-week possible max (ESPN's `possiblePointsMax`). */
  weekMax: number;
  /** 1 + 2 + ... + games: the most anyone could score this week. */
  ladder: number;
}

export function weekScore(entry: PoolEntry, week: number): number {
  return entry.espn.byWeek[String(week)]?.score ?? 0;
}

/** Season total after `week`, from ESPN's per-week scores. */
export function seasonThrough(entry: PoolEntry, week: number): number {
  let total = 0;
  for (const [w, s] of Object.entries(entry.espn.byWeek)) {
    if (Number(w) <= week) total += s.score;
  }
  return total;
}

export function standings(
  pool: PoolModel,
  index: PoolIndex,
  week: number,
  mode: "season" | "week",
): StandingRow[] {
  const ladder = weekLadderTotal(index, week);
  const rows = pool.entries.map((e) => ({
    entryId: e.entryId,
    value: mode === "season" ? seasonThrough(e, week) : weekScore(e, week),
    weekScore: weekScore(e, week),
    weekMax: weekPossibleMax(index, e.entryId, week),
    ladder,
  }));
  const ranks = competitionRanks(rows.map((r) => r.value));
  const top = Math.max(0, ...rows.map((r) => r.value));
  return rows
    .map((r, i) => ({ ...r, rank: ranks[i], back: top - r.value }))
    .sort((a, b) => a.rank - b.rank || b.weekMax - a.weekMax);
}

/** Games in a week that have no result yet. */
export function openGames(index: PoolIndex, week: number): number {
  return (index.gamesByWeek.get(week) ?? []).filter((g) => g.correctOutcomeIds.length === 0)
    .length;
}
