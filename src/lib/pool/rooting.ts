import type { PoolGame } from "@/lib/types";
import type { PoolIndex } from "./aggregate";
import { isLocked } from "./possible";
import { resolveWinners, scoreWeekAll } from "./simulate";

/**
 * "Who should I root for?" for the games being played right now.
 *
 * ESPN hides every pick until kickoff, so only games that have locked but have
 * no result yet can move anyone in a way we can see. For those games we
 * enumerate every combination of winners, weight each by its win probability,
 * and track the viewer's weekly rank. Conditioning on one side of a game gives
 * the viewer's expected rank if that side wins; the gap between the two sides
 * is how many places the game is worth.
 */

export interface RootingSide {
  outcomeId: string;
  /** Chance this side wins, 0-1. */
  winProb: number;
  /** Viewer's expected weekly rank if this side wins. */
  expectedRank: number;
}

export interface RootingGame {
  game: PoolGame;
  sides: [RootingSide, RootingSide];
  /** The side that helps the viewer more, or null when it makes no difference. */
  rootFor: string | null;
  /** Expected places gained by `rootFor` winning instead of the other side. */
  spots: number;
}

export interface RootingGuide {
  games: RootingGame[];
  /** Viewer's expected weekly rank across every live outcome. */
  projectedRank: number;
}

/** Below this, a game is called "either way". */
const NO_PREFERENCE = 0.05;
/** Exact enumeration up to 2^12 combinations; sampled beyond that. */
const MAX_EXACT = 12;
const SAMPLES = 6000;
/** Standard deviation of a full game's final margin (points). */
const MARGIN_SD = 13.5;

/** Games that have kicked off, have visible picks, and are still undecided. */
export function liveGames(index: PoolIndex, week: number, now = Date.now()): PoolGame[] {
  return (index.gamesByWeek.get(week) ?? []).filter(
    (g) => g.correctOutcomeIds.length === 0 && g.outcomes.length === 2 && isLocked(g, index, now),
  );
}

export function rootingGuide(
  index: PoolIndex,
  week: number,
  meId: string,
  now = Date.now(),
): RootingGuide {
  const games = liveGames(index, week, now);
  const entries = index.entries.map((e) => e.entryId);
  const meIdx = entries.indexOf(meId);
  const base = scoreWeekAll(index, week, resolveWinners(week, index, {}));
  const baseScores = entries.map((id) => base[id] ?? 0);

  if (games.length === 0 || meIdx < 0) {
    return { games: [], projectedRank: rankOf(baseScores, meIdx) };
  }

  // Per game: chance outcome[0] wins, and the points each entry gains for
  // either side (0 when they picked the other side or nothing).
  const pA = games.map(winProbFirst);
  const gain = games.map((g) =>
    g.outcomes.map((o) =>
      entries.map((id) => {
        const p = index.picksByEntry.get(id)?.get(g.propId);
        return p && p.outcomeId === o.outcomeId ? p.confidence : 0;
      }),
    ),
  );

  // weight[g][side] and weighted rank sums, for the conditional expectations.
  const wSum = games.map(() => [0, 0]);
  const rSum = games.map(() => [0, 0]);
  let totalW = 0;
  let totalR = 0;
  const scores = new Array<number>(entries.length);

  const visit = (bits: number[], weight: number) => {
    for (let e = 0; e < entries.length; e += 1) scores[e] = baseScores[e];
    for (let g = 0; g < games.length; g += 1) {
      const side = gain[g][bits[g]];
      for (let e = 0; e < entries.length; e += 1) scores[e] += side[e];
    }
    const rank = rankOf(scores, meIdx);
    totalW += weight;
    totalR += weight * rank;
    for (let g = 0; g < games.length; g += 1) {
      wSum[g][bits[g]] += weight;
      rSum[g][bits[g]] += weight * rank;
    }
  };

  const n = games.length;
  const bits = new Array<number>(n).fill(0);
  if (n <= MAX_EXACT) {
    for (let mask = 0; mask < 1 << n; mask += 1) {
      let w = 1;
      for (let g = 0; g < n; g += 1) {
        bits[g] = (mask >> g) & 1;
        w *= bits[g] === 0 ? pA[g] : 1 - pA[g];
      }
      visit(bits, w);
    }
  } else {
    // Seeded so the numbers don't jitter between renders.
    const rand = mulberry32(n * 7919 + entries.length);
    for (let s = 0; s < SAMPLES; s += 1) {
      for (let g = 0; g < n; g += 1) bits[g] = rand() < pA[g] ? 0 : 1;
      visit(bits, 1);
    }
  }

  const fallback = totalR / totalW;
  const result = games.map((game, g): RootingGame => {
    const sides = game.outcomes.map(
      (o, s): RootingSide => ({
        outcomeId: o.outcomeId,
        winProb: s === 0 ? pA[g] : 1 - pA[g],
        expectedRank: wSum[g][s] > 0 ? rSum[g][s] / wSum[g][s] : fallback,
      }),
    ) as [RootingSide, RootingSide];
    const diff = sides[1].expectedRank - sides[0].expectedRank;
    const spots = Math.abs(diff);
    return {
      game,
      sides,
      rootFor: spots < NO_PREFERENCE ? null : diff > 0 ? sides[0].outcomeId : sides[1].outcomeId,
      spots: spots < NO_PREFERENCE ? 0 : spots,
    };
  });

  result.sort((a, b) => b.spots - a.spots || a.game.order - b.game.order);
  return { games: result, projectedRank: fallback };
}

/** Competition rank: 1 + everyone strictly ahead. */
function rankOf(scores: number[], idx: number): number {
  if (idx < 0) return 1;
  let ahead = 0;
  for (let i = 0; i < scores.length; i += 1) if (scores[i] > scores[idx]) ahead += 1;
  return ahead + 1;
}

/**
 * Chance the game's first outcome wins. Starts from the pregame line (betting
 * market, then ESPN's model, then a coin flip) and, while the game is on,
 * folds in the score and clock with a normal margin model: the remaining
 * expected margin shrinks with time left, and so does its spread.
 */
export function winProbFirst(game: PoolGame): number {
  const [a, b] = game.outcomes;
  const pre =
    game.impliedWinProb?.[a.outcomeId] ?? a.bpiWinProb ?? (b.bpiWinProb !== null ? 100 - b.bpiWinProb : 50);
  const p0 = clamp(pre / 100, 0.02, 0.98);

  const left = remainingFraction(game.statusDetail);
  if (game.status === "PENDING" || left === null || a.score === null || b.score === null) {
    return p0;
  }
  const lead = a.score - b.score;
  const mu = invNorm(p0) * MARGIN_SD;
  const r = Math.max(left, 0.005);
  return clamp(normCdf((lead + mu * r) / (MARGIN_SD * Math.sqrt(r))), 0.01, 0.99);
}

/**
 * Share of regulation still to play, from ESPN's status text such as
 * "13:59 - 2nd Quarter", "Halftime" or "End of 3rd Quarter". Null when the
 * text can't be read.
 */
export function remainingFraction(detail: string | null): number | null {
  if (!detail) return null;
  const d = detail.toLowerCase();
  if (d.includes("half")) return 0.5;
  if (/\bot\b|overtime/.test(d)) return 0.02;
  const end = d.match(/end of (?:the )?(\d)/);
  if (end) return clamp((4 - Number(end[1])) / 4, 0, 1);
  const clock = d.match(/(\d{1,2}):(\d{2})\s*-?\s*(\d)(?:st|nd|rd|th)/);
  if (clock) {
    const q = Number(clock[3]);
    const mins = Number(clock[1]) + Number(clock[2]) / 60;
    return clamp(((4 - q) * 15 + mins) / 60, 0, 1);
  }
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26, |error| < 1.5e-7). */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Inverse of `normCdf` by bisection; plenty precise for a margin estimate. */
function invNorm(p: number): number {
  let lo = -6;
  let hi = 6;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
