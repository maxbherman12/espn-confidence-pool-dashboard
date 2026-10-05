/**
 * Normalized, ESPN-API-agnostic model of a Pick'em confidence pool.
 *
 * Everything the dashboard renders derives from `PoolModel`. The normalization
 * layer (lib/espn/normalize.ts) is the only place that knows about ESPN's
 * undocumented payload shapes.
 */

/** ESPN game modes. Only CONFIDENCE (2) carries per-game point values. */
export const SCORING_FORMATS = {
  STRAIGHT: 1,
  CONFIDENCE: 2,
  SPREAD: 3,
  PICK5: 7,
} as const;

export type ScoringFormatId =
  (typeof SCORING_FORMATS)[keyof typeof SCORING_FORMATS];

export const SCORING_FORMAT_LABELS: Record<number, string> = {
  1: "Standard",
  2: "Confidence",
  3: "Spread",
  7: "Pick 5",
};

export type WeekStatus = "COMPLETE" | "IN_PROGRESS" | "FUTURE";

export interface PoolWeek {
  id: number;
  label: string;
  abbrev: string;
  subLabel: string;
  startDate: number;
  endDate: number;
  /** When picks for this week lock. */
  lockDate: number;
  status: WeekStatus;
  /** Games in this week, from the season proposition archive. */
  gameCount: number;
}

export interface Outcome {
  outcomeId: string;
  abbrev: string;
  /** Full team name, e.g. "Los Angeles Rams". */
  name: string;
  teamId: string | null;
  homeAway: "home" | "away" | null;
  logo: string | null;
  color: string | null;
  score: number | null;
  /** Winning NFL moneyline; negative = favorite. */
  moneyline: number | null;
  /** ESPN BPI/FPI projected win probability (0-100). */
  bpiWinProb: number | null;
  /**
   * Share of ALL ESPN pickers (not just this group) who chose this outcome in
   * the group's scoring format, as reported by ESPN's `choiceCounters`.
   */
  national: { count: number; pct: number } | null;
  /** Season record string, e.g. "1-2". */
  record: string | null;
}

export interface PoolGame {
  propId: string;
  week: number;
  /** Display order within the week (0 = first game). */
  order: number;
  /** e.g. "LAR @ DEN" */
  name: string;
  description: string;
  eventId: string | null;
  status: "COMPLETE" | "IN_PROGRESS" | "PENDING";
  /** Live clock text when in progress, e.g. "13:59 - 2nd Quarter". */
  statusDetail: string | null;
  /** Empty while the game is undecided. */
  correctOutcomeIds: string[];
  outcomes: Outcome[];
  spread: number | null;
  overUnder: number | null;
  /** Normalized moneyline implied win probability (vig removed), 0-100. */
  impliedWinProb: { [outcomeId: string]: number } | null;
}

export type PickResult = "CORRECT" | "INCORRECT" | "UNDECIDED";

export interface EntryPick {
  propId: string;
  week: number;
  outcomeId: string;
  /** Confidence points assigned (1..N). Always present, even in non-confidence formats. */
  confidence: number;
  result: PickResult;
}

export interface EspnEntryScore {
  overallScore: number;
  rank: number;
  sortRank: number;
  percentile: number;
  possiblePointsMax: number;
  record: { wins: number; losses: number; ties: number };
  byWeek: Record<
    string,
    { score: number; wins: number; losses: number; possiblePointsMax: number }
  >;
}

export interface PoolEntry {
  entryId: string;
  memberId: string;
  displayName: string;
  entryName: string;
  espn: EspnEntryScore;
  tiebreakAnswers: { questionId: string; answer: number }[];
  /** Every pick this entry has submitted, across all weeks. */
  picks: EntryPick[];
  /** True when this entry submitted fewer picks than the week has games. */
  incomplete: boolean;
}

export interface PoolTiebreak {
  questionId: string;
  week: number;
  question: string;
  status: string;
  overall: boolean;
}

export interface PoolMeta {
  /** Configured group id, echoed back so the client can key its cache. */
  requestedGroupId: string;
  challengeKey: string;
  challengeId: number;
  challengeName: string;
  groupId: string;
  groupName: string;
  groupSize: number;
  scoringFormatId: number;
  scoringFormatLabel: string;
  adminMemberId: string | null;
  currentWeek: number;
  weeks: PoolWeek[];
  tiebreaks: PoolTiebreak[];
  /** Non-fatal problems encountered while enriching (missing odds, etc). */
  warnings: string[];
  /** ESPN's reported entry count, used to detect truncated responses. */
  espnEntryCount: number | null;
  fetchedAt: number;
}

export interface PoolModel {
  meta: PoolMeta;
  entries: PoolEntry[];
  games: PoolGame[];
}

/** Per-outcome aggregate for one game. */
export interface OutcomeAgg {
  outcome: Outcome;
  /** Members who picked this outcome. */
  picks: number;
  /** Picks / members who submitted any pick for this game. */
  share: number;
  /** Sum of confidence assigned to this outcome. */
  confidencePoints: number;
  /** Mean confidence given, 0 when nobody picked it. */
  avgConfidence: number;
  /** Median confidence given, null when nobody picked it. */
  medianConfidence: number | null;
  /** Share of the week's total confidence assigned to this outcome, 0-100. */
  confidenceShare: number;
  /** National pool share, 0-100. Null when ESPN did not report it. */
  nationalShare: number | null;
  /** groupShare - nationalShare in percentage points. */
  edge: number | null;
  /** Members currently correct, 0-1. */
  correctRate: number;
  /** Entry ids currently correct. */
  correctEntries: string[];
  /** Every pick on this outcome, strongest first, for the detail panel. */
  pickers: {
    entryId: string;
    displayName: string;
    entryName: string;
    confidence: number;
    result: "CORRECT" | "INCORRECT" | "UNDECIDED";
  }[];
}

export interface GameAgg {
  game: PoolGame;
  /** Members who submitted at least one pick for this game. */
  respondents: number;
  /** Members who did not pick this game. */
  missed: number;
  /** Highest confidence value used on this game across the group. */
  maxConfidence: number;
  /**
   * Top of the shared confidence ladder (pool-wide, at least 16). The histogram
   * spans 1..ladderTop for every game so the axes are directly comparable.
   */
  ladderTop: number;
  totalConfidencePoints: number;
  byOutcome: OutcomeAgg[];
  /** confidence -> count, for the per-game confidence histogram. */
  histogram: { confidence: number; counts: Record<string, number> }[];
  /** Group is undecided on this game. */
  undecided: boolean;
  /** Value in points if `outcomeId` wins, null for undecided games. */
  pointsAtStake: { [outcomeId: string]: number | null };
  /** Share of members cashing if `outcomeId` wins, 0-1. */
  cashRate: { [outcomeId: string]: number | null };
}

export interface WeekAgg {
  week: number;
  games: GameAgg[];
  respondents: number;
  entryCount: number;
  /** Group average weekly score. */
  avgScore: number;
}

export interface RankedEntry {
  entryId: string;
  displayName: string;
  entryName: string;
  score: number;
  rank: number;
  prevRank: number;
  prevScore: number;
  delta: number;
  possiblePointsMax: number;
  tiebreakAnswers: PoolEntry["tiebreakAnswers"];
}

export interface SimulationResult {
  week: number;
  weekly: RankedEntry[];
  season: RankedEntry[];
  /**
   * Per-entry reachable max for the simulated week: points already banked plus
   * confidence on every game still winnable under the scenario. Equals ESPN's
   * reported `possiblePointsMax` for the current week under the baseline.
   */
  weekMax: Record<string, number>;
  /**
   * True when recomputing from raw picks reproduces ESPN's reported scores and
   * `possiblePointsMax` for every entry. Guards against model drift.
   */
  selfCheckPassed: boolean;
  selfCheckFailures: string[];
}
