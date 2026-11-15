import type { PoolGame } from "@/lib/types";
import type { PoolIndex } from "./aggregate";

/** propId -> winning outcomeId. A game absent from the map is unresolved. */
export type Scenario = Record<string, string>;

/**
 * Whole-week possible max, matching ESPN's `possiblePointsMax`.
 *
 * ESPN hides every pick until its game kicks off, so the picks we can see only
 * cover games that have locked. Summing the visible picks (what the app used to
 * do) gives a "max" that only counts games already played. ESPN's figure covers
 * the whole week instead:
 *
 *   1 + 2 + ... + N            every confidence value the entry will ever hold
 *   - points on visible picks that lost
 *   - for each locked game the entry missed, its lowest unused value
 *
 * Confidence values on games that have not kicked off are hidden, but each is
 * one of the values not yet seen, and every one of them is still winnable.
 *
 * A scenario (the what-if screen) overrides results: a visible pick on an
 * overridden game counts only if it matches the override.
 */
export function weekPossibleMax(
  index: PoolIndex,
  entryId: string,
  week: number,
  scenario: Scenario = {},
): number {
  const games = index.gamesByWeek.get(week) ?? [];
  const n = games.length;
  if (n === 0) return 0;
  const picks = index.picksByEntry.get(entryId);

  const used = new Set<number>();
  let lost = 0;
  let missedLocked = 0;

  for (const game of games) {
    const pick = picks?.get(game.propId);
    if (pick) {
      used.add(pick.confidence);
      const winner = scenario[game.propId] ?? game.correctOutcomeIds[0];
      if (winner && pick.outcomeId !== winner) lost += pick.confidence;
    } else if (isLocked(game, index)) {
      missedLocked += 1;
    }
  }

  // A missed game still burns a confidence value; ESPN charges the lowest one
  // left over.
  for (let v = 1; v <= n && missedLocked > 0; v += 1) {
    if (used.has(v)) continue;
    used.add(v);
    lost += v;
    missedLocked -= 1;
  }

  return (n * (n + 1)) / 2 - lost;
}

/**
 * A game has locked once it kicks off. Visible picks are the most reliable
 * signal (ESPN only reveals them after lock); status and kickoff time cover a
 * game nobody in the group picked.
 */
export function isLocked(
  game: PoolGame,
  index: PoolIndex,
  now: number = Date.now(),
): boolean {
  if (game.status !== "PENDING") return true;
  if (game.kickoff !== null && game.kickoff <= now) return true;
  for (const picks of index.picksByEntry.values()) {
    if (picks.has(game.propId)) return true;
  }
  return false;
}

/** The full confidence ladder for a week: 1 + 2 + ... + games. */
export function weekLadderTotal(index: PoolIndex, week: number): number {
  const n = index.gamesByWeek.get(week)?.length ?? 0;
  return (n * (n + 1)) / 2;
}
