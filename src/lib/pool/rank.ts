/**
 * Competition ("1224") ranking: tied scores share a rank and the next distinct
 * score skips accordingly. Verified against ESPN's own output, which produced
 * 2, 2, 4 and 10, 10, 12 and 15, 15, 17 for this pool.
 */
export function competitionRanks(scores: number[]): number[] {
  const sorted = [...scores].sort((a, b) => b - a);
  const rankByScore = new Map<number, number>();
  let rank = 1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] !== sorted[i - 1]) rank = i + 1;
    rankByScore.set(sorted[i], rank);
  }
  return scores.map((s) => rankByScore.get(s) ?? 1);
}
