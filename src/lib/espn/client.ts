/**
 * Upstream fetches for ESPN's public Pick'em (gambit) API and the public NFL
 * data APIs.
 *
 * All endpoints used here are unauthenticated. The gambit API returns
 * `access-control-allow-origin: *` and `gambit-role: NONE`.
 *
 * Note: `site.api.espn.com` returns 403 to server-side requests, so all NFL
 * data comes from `site.web.api.espn.com` and `sports.core.api.espn.com`.
 */

const GAMBIT = "https://gambit-api.fantasy.espn.com/apis/v1";
const NFL_WEB = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl";
const NFL_CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class EspnApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "EspnApiError";
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://www.espn.com/",
      ...init?.headers,
    },
    // Upstream data is already CDN-cached; never serve a stale local copy.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new EspnApiError(
      `ESPN request failed: ${res.status} ${res.statusText}`,
      res.status,
      url,
    );
  }
  return (await res.json()) as T;
}

async function getJsonWithHeaders<T>(
  url: string,
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://www.espn.com/",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new EspnApiError(
      `ESPN request failed: ${res.status} ${res.statusText}`,
      res.status,
      url,
    );
  }
  return { data: (await res.json()) as T, headers: res.headers };
}

const json = getJson;

/* ------------------------------------------------------------------ *
 * Upstream payload shapes (only the fields we read are typed)
 * ------------------------------------------------------------------ */

export interface RawMapping {
  type: string;
  value: string;
}

export interface RawChoiceCounter {
  count: number;
  outcomeId: string;
  percentage: number;
  scoringFormatId: number;
}

export interface RawOutcome {
  id: string;
  abbrev: string;
  name: string;
  description: string;
  subType: "AWAY" | "HOME" | null;
  score?: number | null;
  /** Team record, e.g. "1-0". */
  additionalInfo?: string | null;
  status: string;
  statusAlert?: string;
  resultInfo?: string | null;
  type: string;
  choiceCounters?: RawChoiceCounter[];
  mappings?: RawMapping[];
}

export interface RawProposition {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  scoringPeriodId: number;
  status: string;
  correctOutcomes: string[];
  correctOutcomeOverrides?: Record<string, string>;
  date: number;
  lockDate?: number;
  possibleOutcomes: RawOutcome[];
  mappings?: RawMapping[];
}

export interface RawScoringPeriod {
  id: number;
  label: string;
  abbrev: string;
  subLabel: string;
  startDate: number;
  endDate: number;
  firstPropositionLockDate: number;
  allPropositionsLocked: boolean;
}

export interface RawChallenge {
  id: number;
  key: string;
  name: string;
  abbrev: string;
  gameType: string;
  currentScoringPeriod: RawScoringPeriod;
  scoringPeriods: RawScoringPeriod[];
  scoringStatus: { scoringExecuted: boolean; anyPropositionScored: boolean };
  propositions: RawProposition[];
  tiebreakQuestions: RawTiebreak[];
  scoringFormatIds: number[];
  clientFlags: Record<string, string>;
}

export interface RawTiebreak {
  id: string;
  question: string;
  scoringPeriodId: number;
  status: string;
  overall: boolean;
  display: boolean;
  type: string;
}

export interface RawPick {
  propositionId: string;
  confidenceScore: number;
  outcomesPicked: {
    outcomeId: string;
    result: "CORRECT" | "INCORRECT" | "UNDECIDED";
    rank: number | null;
  }[];
}

export interface RawScore {
  overallScore: number;
  rank: number;
  sortRank: number;
  percentile: number;
  possiblePointsMax: number;
  record: { wins: number; losses: number; ties: number };
  scoreByPeriod: Record<
    string,
    {
      score: number;
      invalid: boolean;
      possiblePointsMax: number;
      record: { wins: number; losses: number } | null;
    }
  >;
}

export interface RawEntry {
  id: string;
  member: { id: string; displayName: string };
  name: string;
  picks: RawPick[];
  score: RawScore;
  tiebreakAnswers?: { tiebreakQuestionId: string; answer: number }[];
}

export interface RawGroup {
  challengeId: number;
  groupId: string;
  size: number;
  challengeSettings: {
    scoringFormatId: number;
    entriesPerMember: number;
    scoringSettings: Record<string, unknown>;
  };
  groupSettings: {
    name: string;
    public: boolean;
    adminMemberIds: string[];
  };
  entries: RawEntry[];
}

export interface RawScoreboardEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  week: number;
  status: {
    clock?: number;
    displayClock?: string;
    period?: number;
    type: { id: string; name: string; state: string; completed: boolean; description: string; detail: string; shortDetail: string };
  };
  competitions: {
    id: string;
    competitors: {
      id: string;
      homeAway: string;
      score: string;
      records: { name: string; summary: string }[];
      team: {
        id: string;
        abbreviation: string;
        displayName: string;
        color: string;
        alternateColor: string;
        logos: { rel: string[]; href: string }[];
      };
    }[];
    odds?: RawPickcenter[] | null;
  }[];
}

export interface RawPickcenter {
  provider: { id: string; name: string };
  details: string;
  overUnder: number;
  spread: number;
  awayTeamOdds: { moneyLine: number; spreadOdds: number; teamId: string; favorite: boolean };
  homeTeamOdds: { moneyLine: number; spreadOdds: number; teamId: string; favorite: boolean };
}

/**
 * `GET /apis/v1/groups/{id}` - the group/league lookup that does not require
 * knowing which challenge it belongs to. It is the only entry point needed to
 * bootstrap a league id into a full pool.
 */
export interface RawLeague {
  id: string;
  challenges: { challengeId: number; challengeSettings?: unknown }[];
  settings?: unknown;
}

export interface RawPredictionStats {
  name: string;
  displayName?: string;
  abbreviation?: string;
  value: number;
  displayValue?: string;
}

/** One side of the predictor payload: a team `$ref` plus its BPI statistics. */
export interface RawPredictionSide {
  team?: { $ref?: string };
  statistics: RawPredictionStats[];
}

/**
 * `.../competitions/{id}/predictor`. Both sides are described by a core-API
 * `$ref` (the team id is the last numeric path segment) and a statistics array
 * where `gameProjection` is the projected win percentage for that team.
 */
export interface RawPrediction {
  $ref?: string;
  name?: string;
  shortName?: string;
  lastModified?: string;
  homeTeam?: RawPredictionSide;
  awayTeam?: RawPredictionSide;
}

/** ESPN core team id from a `$ref` like `.../seasons/2026/teams/26?lang=en`. */
export function teamIdFromRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const m = ref.match(/\/teams\/(\d+)/);
  return m ? m[1] : null;
}

/** Projected win percentage (`gameProjection`, 0-100) for one side. */
export function predictionWinProb(
  side: RawPredictionSide | undefined,
): number | null {
  const gp = side?.statistics?.find((s) => s.name === "gameProjection");
  if (!gp || typeof gp.value !== "number") return null;
  return gp.value;
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

/**
 * Challenge metadata, current week's propositions, and tiebreak questions.
 *
 * ESPN accepts either the readable challenge key or the numeric challenge id
 * on every `/challenges/...` path, which is what lets a league id be the only
 * input the app ever needs: `/apis/v1/groups/{id}` resolves one to the other.
 */
export function fetchChallenge(
  challenge: string | number,
  week?: number,
): Promise<RawChallenge> {
  const q = new URLSearchParams({ view: "chui_default" });
  if (week) q.set("scoringPeriodId", String(week));
  return json<RawChallenge>(`${GAMBIT}/challenges/${challenge}?${q}`);
}

/** All propositions for the whole season (has `scoringPeriodId` on each). */
export function fetchAllPropositions(
  challengeId: number,
): Promise<RawProposition[]> {
  return json<RawProposition[]>(
    `${GAMBIT}/propositions?challengeId=${challengeId}`,
  );
}

/**
 * Every entry in a group plus every pick each entry has submitted. The
 * `gambit-filter-entry-count` response header carries the true roster size,
 * which may exceed the page returned.
 */
export async function fetchGroupPicks(
  challenge: string | number,
  groupId: string,
): Promise<{ data: RawGroup; entryCount: number | null }> {
  const { data, headers } = await getJsonWithHeaders<RawGroup>(
    `${GAMBIT}/challenges/${challenge}/groups/${groupId}?view=chui_pagetype_group_picks`,
  );
  const raw = headers.get("gambit-filter-entry-count");
  return { data, entryCount: raw ? Number(raw) : null };
}

/** Group settings, member roster, and leaderboard (no picks). */
export function fetchGroup(
  challenge: string | number,
  groupId: string,
): Promise<RawGroup> {
  return json<RawGroup>(
    `${GAMBIT}/challenges/${challenge}/groups/${groupId}?view=chui_default_group`,
  );
}

/**
 * Resolves a league (group) id to the numeric challenge id it belongs to.
 * Returns `null` when ESPN does not know the id.
 */
export async function fetchLeague(leagueId: string): Promise<number | null> {
  const url = `${GAMBIT}/groups/${encodeURIComponent(leagueId)}`;
  let league: RawLeague;
  try {
    league = await json<RawLeague>(url);
  } catch (error) {
    if (error instanceof EspnApiError && error.status === 404) return null;
    throw error;
  }
  return league.challenges?.[0]?.challengeId ?? null;
}

/**
 * The NFL season year for a challenge, recovered from its first scoring
 * period. Needed because the scoreboard and odds endpoints are keyed by season
 * while everything else is keyed by challenge id.
 */
export function seasonFromChallenge(challenge: RawChallenge): number | null {
  const start = challenge.scoringPeriods?.[0]?.startDate;
  if (!start) return null;
  const d = new Date(start);
  const year = d.getUTCFullYear();
  // A season that opens in January or February belongs to the prior year.
  return d.getUTCMonth() <= 1 ? year - 1 : year;
}

export function fetchAllTiebreaks(challengeId: number): Promise<RawTiebreak[]> {
  return json<RawTiebreak[]>(
    `${GAMBIT}/tiebreakquestions?challengeId=${challengeId}`,
  );
}

/** One week of NFL games: teams, records, colors, live status, weather. */
export function fetchScoreboard(
  season: number,
  week: number,
  seasontype = 2,
): Promise<{ events: RawScoreboardEvent[] }> {
  return json<{ events: RawScoreboardEvent[] }>(
    `${NFL_WEB}/scoreboard?dates=${season}&seasontype=${seasontype}&week=${week}`,
  );
}

/**
 * Betting lines for one game. Not available in bulk, so this is one call per
 * game; callers must treat failure as non-fatal.
 */
export async function fetchPickcenter(
  eventId: string,
): Promise<RawPickcenter | null> {
  try {
    const summary = await json<{ pickcenter?: RawPickcenter[] }>(
      `${NFL_WEB}/summary?event=${eventId}`,
    );
    return summary.pickcenter?.[0] ?? null;
  } catch {
    return null;
  }
}

/** ESPN's BPI/FPI projected win probability for one game. */
export async function fetchPredictor(
  eventId: string,
): Promise<RawPrediction | null> {
  try {
    return await json<RawPrediction>(
      `${NFL_CORE}/events/${eventId}/competitions/${eventId}/predictor`,
    );
  } catch {
    return null;
  }
}

/**
 * Resolves American moneylines to implied win probabilities with the vig
 * removed, so the two sides sum to 100.
 */
export function impliedWinProbabilities(
  moneylines: { [outcomeId: string]: number | null },
): { [outcomeId: string]: number } | null {
  const entries = Object.entries(moneylines).filter(
    (e): e is [string, number] => typeof e[1] === "number" && e[1] !== 0,
  );
  if (entries.length < 2) return null;

  const raw = entries.map(([, ml]) => {
    // -150 favorite -> 150/250; +130 underdog -> 100/230
    const positive = ml > 0 ? ml + 100 : -ml;
    return positive / (positive + 100);
  });
  const total = raw.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const out: { [outcomeId: string]: number } = {};
  entries.forEach(([id], i) => {
    out[id] = (raw[i] / total) * 100;
  });
  return out;
}
