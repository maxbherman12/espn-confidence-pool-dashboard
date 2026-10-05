import type { PoolIndex } from "./aggregate";
import { entryLabel } from "@/lib/name";
import { competitionRanks } from "./rank";
import type { PoolModel } from "@/lib/types";

export interface WeekRow {
  entryId: string;
  displayName: string;
  entryName: string;
  score: number;
  rank: number;
}

/**
 * The week's leaderboard, restricted to members who actually submitted a pick
 * somewhere in the week. Including non-participants would put everyone who sat
 * that week out at a shared zero, which is not a meaningful "last place".
 */
export function weekLeaderboard(
  pool: PoolModel,
  index: PoolIndex,
  week: number,
): WeekRow[] {
  const games = index.gamesByWeek.get(week) ?? [];
  const scored = pool.entries
    .map((e) => {
      const picks = index.picksByEntry.get(e.entryId);
      const played = games.some((g) => picks?.has(g.propId));
      return {
        entryId: e.entryId,
        displayName: e.displayName,
        entryName: e.entryName,
        score: e.espn.byWeek[String(week)]?.score ?? 0,
        played,
      };
    })
    .filter((r) => r.played);

  const ranks = competitionRanks(scored.map((r) => r.score));
  return scored
    .map((r, i) => ({ ...r, rank: ranks[i] }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.score - a.score ||
        entryLabel(a.entryName, a.displayName).localeCompare(
          entryLabel(b.entryName, b.displayName),
        ),
    );
}

export interface WeekSummary {
  /** Mean score across participating members. */
  average: number;
  leader: WeekRow | null;
  last: WeekRow | null;
  participants: number;
  /** Set when nobody has submitted picks yet, i.e. a future week. */
  empty: boolean;
}

export function weekSummary(
  pool: PoolModel,
  index: PoolIndex,
  week: number,
): WeekSummary {
  const board = weekLeaderboard(pool, index, week);
  return {
    average: board.length
      ? board.reduce((a, b) => a + b.score, 0) / board.length
      : 0,
    leader: board[0] ?? null,
    last: board.length > 0 ? board[board.length - 1] : null,
    participants: board.length,
    empty: board.length === 0,
  };
}
