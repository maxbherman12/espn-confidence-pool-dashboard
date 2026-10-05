import { describe, expect, it } from "vitest";
import {
  fetchAllPropositions,
  fetchAllTiebreaks,
  fetchChallenge,
  fetchGroupPicks,
  fetchLeague,
  fetchScoreboard,
  seasonFromChallenge,
} from "@/lib/espn/client";
import { normalizePool } from "@/lib/espn/normalize";
import { aggregateGame, indexPool } from "@/lib/pool/aggregate";
import { competitionRanks } from "@/lib/pool/rank";
import { weekLeaderboard, weekSummary } from "@/lib/pool/summary";
import {
  baselineScenario,
  reachablePoints,
  resolveWinners,
  scoreSeasonAll,
  scoreWeekAll,
  simulate,
  undecidedGames,
  weekCeiling,
} from "@/lib/pool/simulate";
import { entryLabel } from "@/lib/name";
import type { PoolModel } from "@/lib/types";

// No league is baked into the repo. Point these at any public group to verify
// the engine against that pool.
const LEAGUE = process.env.TEST_LEAGUE_ID ?? process.env.LEAGUE_ID ?? "";

if (!LEAGUE) {
  throw new Error(
    "No league configured. Pass TEST_LEAGUE_ID=<group-id> to `npm test` (see " +
      ".env.example). Nothing in the repo is tied to a specific league.",
  );
}

/**
 * Loads through the same path the app uses - league id in, resolved challenge
 * out - so these tests also cover the league -> challenge lookup.
 */
async function loadPool(): Promise<PoolModel> {
  const challengeId = await fetchLeague(LEAGUE);
  expect(challengeId).not.toBeNull();

  const challenge = await fetchChallenge(challengeId as number);
  const [archive, tiebreaks, picks] = await Promise.all([
    fetchAllPropositions(challengeId as number),
    fetchAllTiebreaks(challengeId as number),
    fetchGroupPicks(challengeId as number, LEAGUE),
  ]);
  const season = seasonFromChallenge(challenge);
  const events = (await fetchScoreboard(season as number, challenge.currentScoringPeriod.id))
    .events;
  return normalizePool({
    challenge,
    archive,
    tiebreaks,
    group: picks.data,
    scoreboardEvents: events,
    pickcenters: new Map(),
    predictors: new Map(),
    warnings: [],
    espnEntryCount: picks.entryCount,
    requestedGroupId: LEAGUE,
  });
}

const pool = await loadPool();
const index = indexPool(pool);

describe("league resolution", () => {
  it("resolves a league id to its challenge without a configured key", async () => {
    expect(pool.meta.challengeId).toBeGreaterThan(0);
    expect(pool.meta.challengeKey).toBeTruthy();
    expect(pool.meta.requestedGroupId).toBe(LEAGUE);
  });

  it("recovers a plausible NFL season from the first scoring period", () => {
    const season = seasonFromChallenge({
      scoringPeriods: [
        { startDate: Date.UTC(2026, 8, 9) },
        { startDate: Date.UTC(2026, 8, 16) },
      ],
    } as Parameters<typeof seasonFromChallenge>[0]);
    expect(season).toBe(2026);
    // A January start belongs to the prior season.
    expect(
      seasonFromChallenge({
        scoringPeriods: [{ startDate: Date.UTC(2027, 0, 10) }],
      } as Parameters<typeof seasonFromChallenge>[0]),
    ).toBe(2026);
  });

  it("returns null for an id ESPN does not know", async () => {
    expect(
      await fetchLeague("00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });
});

describe("confidence scoring engine (live ESPN data)", () => {
  it("loads a non-trivial pool", () => {
    expect(pool.entries.length).toBeGreaterThan(1);
    expect(pool.games.length).toBeGreaterThan(0);
    expect(pool.meta.groupName).toBeTruthy();
  });

  it("reproduces ESPN's reported score for every entry-week", () => {
    const mismatches: string[] = [];
    for (const e of pool.entries) {
      const byWeek = new Map<number, { score: number; wins: number; losses: number }>();
      for (const p of e.picks) {
        const cur = byWeek.get(p.week) ?? { score: 0, wins: 0, losses: 0 };
        if (p.result === "CORRECT") {
          cur.score += p.confidence;
          cur.wins += 1;
        } else if (p.result === "INCORRECT") {
          cur.losses += 1;
        }
        byWeek.set(p.week, cur);
      }
      for (const [week, espn] of Object.entries(e.espn.byWeek)) {
        if (espn.score === 0 && !espn.wins && !espn.losses) continue;
        const mine = byWeek.get(Number(week));
        if (!mine) continue;
        if (mine.score !== espn.score || mine.wins !== espn.wins || mine.losses !== espn.losses) {
          mismatches.push(
            `${entryLabel(e.entryName, e.displayName)} wk${week}: mine=${JSON.stringify(mine)} espn=${JSON.stringify({ score: espn.score, wins: espn.wins, losses: espn.losses })}`,
          );
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("reproduces ESPN's reported season total and rank for every entry", () => {
    const mismatches: string[] = [];
    for (const e of pool.entries) {
      let total = 0;
      for (const [week, v] of Object.entries(e.espn.byWeek)) {
        if (Number(week) > pool.meta.currentWeek) continue;
        total += v.score;
      }
      if (total !== e.espn.overallScore) {
        mismatches.push(`${entryLabel(e.entryName, e.displayName)}: ${total} vs ${e.espn.overallScore}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("matches ESPN's ranks using competition ranking", () => {
    const scores = pool.entries.map((e) => e.espn.overallScore);
    const ranks = competitionRanks(scores);
    pool.entries.forEach((e, i) => {
      expect(`${entryLabel(e.entryName, e.displayName)}:${ranks[i]}`).toBe(`${entryLabel(e.entryName, e.displayName)}:${e.espn.rank}`);
    });
  });

  it("reproduces ESPN's possiblePointsMax for the current week", () => {
    const week = pool.meta.currentWeek;
    const failures: string[] = [];
    for (const e of pool.entries) {
      const espn = e.espn.byWeek[String(week)]?.possiblePointsMax;
      if (typeof espn !== "number") continue;
      const ours = reachablePoints(index, e.entryId, week);
      if (ours !== espn) {
        failures.push(`${entryLabel(e.entryName, e.displayName)}: ${ours} vs ${espn}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("baseline simulation is a no-op against ESPN's reported scores", () => {
    const week = pool.meta.currentWeek;
    const result = simulate(pool, { week, scenario: {} });
    expect(result.selfCheckFailures).toEqual([]);
    expect(result.selfCheckPassed).toBe(true);

    for (const e of pool.entries) {
      const row = result.weekly.find((r) => r.entryId === e.entryId)!;
      expect(row.score).toBe(e.espn.byWeek[String(week)]?.score ?? 0);
    }
  });

  it("never awards more than the confidence an entry actually allocated", () => {
    const week = pool.meta.currentWeek;
    // Build a scenario that matches the first entry's picks on every game, so
    // at least one entry goes as well as it possibly could.
    const winners: Record<string, string> = {};
    for (const game of index.gamesByWeek.get(week) ?? []) {
      const pick = index.picksByEntry.get(pool.entries[0].entryId)?.get(game.propId);
      if (pick) winners[game.propId] = pick.outcomeId;
    }
    const scores = scoreWeekAll(index, week, resolveWinners(week, index, winners));
    const ceiling = weekCeiling(index, week);
    for (const e of pool.entries) {
      expect(scores[e.entryId]).toBeLessThanOrEqual(ceiling[e.entryId]);
    }
  });

  it("reports a reachable max equal to ESPN's possiblePointsMax", () => {
    const week = pool.meta.currentWeek;
    const result = simulate(pool, { week, scenario: {} });
    for (const e of pool.entries) {
      expect(result.weekMax[e.entryId]).toBe(
        e.espn.byWeek[String(week)]?.possiblePointsMax ?? 0,
      );
    }
  });

  it("keeps the season max consistent with the weekly max", () => {
    const week = pool.meta.currentWeek;
    const result = simulate(pool, { week, scenario: {} });
    for (const row of result.season) {
      // Completed weeks before this one are already resolved, so the season
      // max is the weekly max plus everything banked earlier.
      expect(row.possiblePointsMax).toBeGreaterThanOrEqual(result.weekMax[row.entryId]);
    }
  });

  it("keeps season totals monotonic when the simulated week is the current one", () => {
    const week = pool.meta.currentWeek;
    const base = scoreSeasonAll(index, week, resolveWinners(week, index, baselineScenario(index)));
    for (const e of pool.entries) {
      expect(base[e.entryId]).toBe(e.espn.overallScore);
    }
  });

  it("backtesting a completed week changes the total by exactly the flipped points", () => {
    const pastWeek = pool.meta.currentWeek - 1;
    if (pastWeek < 1) return;
    const game = (index.gamesByWeek.get(pastWeek) ?? []).find(
      (g) => g.correctOutcomeIds.length > 0,
    );
    if (!game) return;
    const flipTarget = game.outcomes.find(
      (o) => o.outcomeId !== game.correctOutcomeIds[0],
    );
    if (!flipTarget) return;

    const before = scoreSeasonAll(index, pastWeek, resolveWinners(pastWeek, index, {}));
    const after = scoreSeasonAll(
      index,
      pastWeek,
      resolveWinners(pastWeek, index, { [game.propId]: flipTarget.outcomeId }),
    );
    for (const e of pool.entries) {
      const pick = index.picksByEntry.get(e.entryId)?.get(game.propId);
      const delta = pick
        ? pick.outcomeId === game.correctOutcomeIds[0]
          ? -pick.confidence
          : pick.confidence
        : 0;
      expect(after[e.entryId] - before[e.entryId]).toBe(delta);
    }
  });

  it("identifies undecided games and only those", () => {
    const week = pool.meta.currentWeek;
    for (const g of index.gamesByWeek.get(week) ?? []) {
      const agg = aggregateGame(g, index);
      expect(agg.undecided).toBe(g.correctOutcomeIds.length === 0);
    }
    expect(undecidedGames(week, index).every((g) => g.correctOutcomeIds.length === 0)).toBe(
      true,
    );
  });

  it("aggregates pick counts back to the group size for every game", () => {
    for (const g of index.games) {
      const agg = aggregateGame(g, index);
      const sum = agg.byOutcome.reduce((a, o) => a + o.picks, 0);
      expect(sum).toBe(agg.respondents);
    }
  });
});

describe("confidence ladder", () => {
  it("gives every game the same 1..16 axis so charts are comparable", () => {
    expect(index.ladderTop).toBeGreaterThanOrEqual(16);
    for (const g of index.games) {
      const agg = aggregateGame(g, index);
      expect(agg.histogram.length).toBe(index.ladderTop);
      expect(agg.histogram.map((h) => h.confidence)).toEqual(
        Array.from({ length: index.ladderTop }, (_, i) => i + 1),
      );
    }
  });

  it("uses the full ladder even for a game nobody bet heavily on", () => {
    // The quietest game is the one that used to render a short axis; it must
    // still span 1..ladderTop.
    const quietest = index.games
      .map((g) => aggregateGame(g, index))
      .filter((a) => a.respondents > 0)
      .sort((a, b) => a.maxConfidence - b.maxConfidence)[0];
    expect(quietest.maxConfidence).toBeLessThan(index.ladderTop);
    expect(quietest.histogram.length).toBe(index.ladderTop);
  });

  it("counts every picker into exactly one rung", () => {
    for (const g of index.games) {
      const agg = aggregateGame(g, index);
      for (const h of agg.histogram) {
        const n = Object.values(h.counts).reduce((a, b) => a + b, 0);
        const actual = index.entries.filter((e) => {
          const pick = index.picksByEntry.get(e.entryId)?.get(g.propId);
          return pick?.confidence === h.confidence;
        }).length;
        expect(n).toBe(actual);
      }
      const total = agg.histogram.reduce(
        (s, h) => s + Object.values(h.counts).reduce((a, b) => a + b, 0),
        0,
      );
      expect(total).toBe(agg.respondents);
    }
  });

  it("keeps maxConfidence as the observed high-water mark", () => {
    for (const g of index.games) {
      const agg = aggregateGame(g, index);
      const used = agg.histogram
        .filter((h) => Object.keys(h.counts).length > 0)
        .map((h) => h.confidence);
      expect(agg.maxConfidence).toBe(used.length ? Math.max(...used) : 0);
    }
  });
});

describe("week summary (league overview)", () => {
  it("orders the week by score and assigns ESPN-style competition ranks", () => {
    const week = pool.meta.currentWeek;
    const board = weekLeaderboard(pool, index, week);
    expect(board.length).toBeGreaterThan(0);

    // Descending by score, and ranks consistent with competition ranking.
    for (let i = 1; i < board.length; i += 1) {
      expect(board[i - 1].score).toBeGreaterThanOrEqual(board[i].score);
    }
    const expected = competitionRanks(board.map((r) => r.score));
    expect(board.map((r) => r.rank)).toEqual(expected);
  });

  it("agrees with ESPN's per-week scores", () => {
    const week = pool.meta.currentWeek;
    for (const row of weekLeaderboard(pool, index, week)) {
      const entry = pool.entries.find((e) => e.entryId === row.entryId);
      expect(row.score).toBe(entry?.espn.byWeek[String(week)]?.score ?? 0);
    }
  });

  it("puts the highest scorer first and the lowest last", () => {
    const week = pool.meta.currentWeek;
    const board = weekLeaderboard(pool, index, week);
    const summary = weekSummary(pool, index, week);
    const scores = board.map((r) => r.score);

    expect(summary.empty).toBe(false);
    expect(summary.participants).toBe(board.length);
    expect(summary.leader?.entryId).toBe(
      board.find((r) => r.score === Math.max(...scores))?.entryId,
    );
    expect(summary.last?.entryId).toBe(
      board.find((r) => r.score === Math.min(...scores))?.entryId,
    );
    // The mean must sit inside the observed range.
    expect(summary.average).toBeGreaterThanOrEqual(Math.min(...scores));
    expect(summary.average).toBeLessThanOrEqual(Math.max(...scores));
  });

  it("excludes members who submitted no picks in the week", () => {
    const week = pool.meta.currentWeek;
    const board = weekLeaderboard(pool, index, week);
    const games = index.gamesByWeek.get(week) ?? [];
    for (const row of board) {
      const picks = index.picksByEntry.get(row.entryId);
      expect(games.some((g) => picks?.has(g.propId))).toBe(true);
    }
    expect(board.length).toBeLessThanOrEqual(pool.entries.length);
  });

  it("treats a week nobody has picked as empty rather than all-zero", () => {
    const future = pool.meta.weeks.find((w) => w.status === "FUTURE");
    if (!future) return;
    const summary = weekSummary(pool, index, future.id);
    expect(summary.empty).toBe(true);
    expect(summary.leader).toBeNull();
    expect(summary.last).toBeNull();
  });
});

describe("competitionRanks", () => {
  it("shares ranks on ties and skips correctly", () => {
    expect(competitionRanks([90, 79, 79, 73])).toEqual([1, 2, 2, 4]);
    expect(competitionRanks([100, 90, 90, 80, 80])).toEqual([1, 2, 2, 4, 4]);
    expect(competitionRanks([5, 5, 5])).toEqual([1, 1, 1]);
    expect(competitionRanks([1, 2, 3])).toEqual([3, 2, 1]);
  });
});
