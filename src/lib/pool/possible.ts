import type { PoolGame } from "@/lib/types";
import type { PoolIndex } from "./aggregate";

/** propId -> winning outcomeId. A game absent from the map is unresolved. */
export type Scenario = Record<string, string>;

/**
 * Whole-week possible max, matching ESPN's `possiblePointsMax`:
 *
 *   1 + 2 + ... + N            every confidence value the entry holds
 *   - points on visible picks that lost
 *   - for each revealed game the entry missed, its lowest unused value
 *
 * A missed pick still burns a confidence value, and ESPN charges the lowest one
 * left over. Example: 14 games (105 points), nine early games missed and the
 * late games picked with 14, 13 and 12 -> 105 - (1 + ... + 9) = 60.
 *
 * Picks on games that haven't kicked off are hidden, but each holds one of the
 * values not yet seen and is still winnable, so they stay in the total.
 *
 * A game only counts as missed once its picks are revealed (someone in the
 * group has a visible pick on it). Right after kickoff ESPN can lag, and
 * charging everyone for a game whose picks just haven't shown up yet would
 * understate every max.
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

  let lost = 0;
  for (const game of games) {
    const pick = picks?.get(game.propId);
    if (!pick) continue;
    const winner = scenario[game.propId] ?? game.correctOutcomeIds[0];
    if (winner && pick.outcomeId !== winner) lost += pick.confidence;
  }
  for (const v of skippedValues(index, entryId, week).values()) lost += v;

  return (n * (n + 1)) / 2 - lost;
}

/**
 * Games an entry skipped (revealed with no pick) and the confidence value each
 * one burned: the lowest values the entry hasn't visibly used, in game order.
 */
export function skippedValues(
  index: PoolIndex,
  entryId: string,
  week: number,
): Map<string, number> {
  const games = index.gamesByWeek.get(week) ?? [];
  const picks = index.picksByEntry.get(entryId);
  const used = new Set<number>();
  const skipped: string[] = [];
  for (const game of games) {
    const pick = picks?.get(game.propId);
    if (pick) used.add(pick.confidence);
    else if (isRevealed(game, index)) skipped.push(game.propId);
  }

  const out = new Map<string, number>();
  let v = 1;
  for (const propId of skipped) {
    while (used.has(v)) v += 1;
    if (v > games.length) break;
    used.add(v);
    out.set(propId, v);
  }
  return out;
}

/** True once anyone in the group has a visible pick on the game. */
function isRevealed(game: PoolGame, index: PoolIndex): boolean {
  for (const picks of index.picksByEntry.values()) {
    if (picks.has(game.propId)) return true;
  }
  return false;
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
