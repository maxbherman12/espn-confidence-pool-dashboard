import { describe, expect, it } from "vitest";
import { indexPool } from "../src/lib/pool/aggregate";
import { remainingFraction, rootingGuide, winProbFirst } from "../src/lib/pool/rooting";
import type { EntryPick, Outcome, PoolEntry, PoolGame, PoolModel } from "../src/lib/types";

const outcome = (id: string, homeAway: "home" | "away", score: number | null = null): Outcome => ({
  outcomeId: id,
  abbrev: id,
  name: id,
  teamId: null,
  homeAway,
  logo: null,
  color: null,
  score,
  moneyline: null,
  bpiWinProb: 50,
  national: null,
  record: null,
});

const game = (
  propId: string,
  order: number,
  status: PoolGame["status"],
  correct: string[] = [],
  scores: [number | null, number | null] = [null, null],
  statusDetail: string | null = null,
): PoolGame => ({
  propId,
  week: 1,
  order,
  name: propId,
  description: propId,
  eventId: null,
  status,
  statusDetail,
  kickoff: status === "PENDING" ? Date.now() + 3_600_000 : Date.now() - 3_600_000,
  correctOutcomeIds: correct,
  outcomes: [outcome(`${propId}A`, "away", scores[0]), outcome(`${propId}H`, "home", scores[1])],
  spread: null,
  overUnder: null,
  impliedWinProb: null,
});

const entry = (entryId: string, picks: [string, string, number][]): PoolEntry => ({
  entryId,
  memberId: entryId,
  displayName: entryId,
  entryName: entryId,
  espn: {
    overallScore: 0,
    rank: 1,
    sortRank: 1,
    percentile: 0,
    possiblePointsMax: 0,
    record: { wins: 0, losses: 0, ties: 0 },
    byWeek: {},
  },
  tiebreakAnswers: [],
  picks: picks.map(
    ([propId, outcomeId, confidence]): EntryPick => ({
      propId,
      week: 1,
      outcomeId,
      confidence,
      result: "UNDECIDED",
    }),
  ),
  incomplete: false,
});

const pool = (games: PoolGame[], entries: PoolEntry[]): PoolModel =>
  ({ meta: { currentWeek: 1 }, games, entries }) as unknown as PoolModel;

describe("rootingGuide", () => {
  // g1 is final; g2 and g3 are live. "me" trails "rival" by 2 after g1.
  const games = [
    game("g1", 0, "COMPLETE", ["g1A"]),
    game("g2", 1, "IN_PROGRESS"),
    game("g3", 2, "IN_PROGRESS"),
  ];
  const entries = [
    entry("me", [["g1", "g1A", 1], ["g2", "g2A", 3], ["g3", "g3A", 2]]),
    entry("rival", [["g1", "g1A", 3], ["g2", "g2H", 2], ["g3", "g3A", 1]]),
  ];
  const index = indexPool(pool(games, entries));

  it("roots for the side that separates you from rivals", () => {
    const guide = rootingGuide(index, 1, "me");
    const g2 = guide.games.find((g) => g.game.propId === "g2")!;
    // g2A: me +3, rival +0 -> me ahead. g2H: rival +2 -> rival ahead.
    expect(g2.rootFor).toBe("g2A");
    expect(g2.spots).toBeCloseTo(1, 5);
    expect(guide.games[0].game.propId).toBe("g2");
  });

  it("calls a game either way when it can't change your rank", () => {
    const guide = rootingGuide(index, 1, "me");
    const g3 = guide.games.find((g) => g.game.propId === "g3")!;
    // Both picked g3A: it adds to both scores, never flipping the order.
    expect(g3.rootFor).toBeNull();
    expect(g3.spots).toBe(0);
  });

  it("ignores finished and not-yet-started games", () => {
    const idx = indexPool(
      pool([game("g1", 0, "COMPLETE", ["g1A"]), game("g4", 1, "PENDING")], entries),
    );
    const guide = rootingGuide(idx, 1, "me");
    expect(guide.games).toHaveLength(0);
    expect(guide.projectedRank).toBe(2);
  });
});

describe("win probability", () => {
  it("reads ESPN status text", () => {
    expect(remainingFraction("13:59 - 2nd Quarter")).toBeCloseTo((2 * 15 + 13 + 59 / 60) / 60, 5);
    expect(remainingFraction("Halftime")).toBe(0.5);
    expect(remainingFraction("End of 3rd Quarter")).toBe(0.25);
    expect(remainingFraction("Delayed")).toBeNull();
  });

  it("favors the leader more as time runs out", () => {
    const early = winProbFirst(game("x", 0, "IN_PROGRESS", [], [7, 0], "14:00 - 1st Quarter"));
    const late = winProbFirst(game("x", 0, "IN_PROGRESS", [], [7, 0], "2:00 - 4th Quarter"));
    expect(early).toBeGreaterThan(0.5);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(0.9);
  });
});
