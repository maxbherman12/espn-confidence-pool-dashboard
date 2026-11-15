import type { Person } from "@/lib/name";
import { aggregateGame, type PoolIndex } from "@/lib/pool/aggregate";
import { isLocked } from "@/lib/pool/possible";
import type { Outcome, PoolGame } from "@/lib/types";
import type { RingTone } from "@/components/ui";

export interface SidePicker {
  entryId: string;
  person: Person | undefined;
  confidence: number;
}

export interface SideView {
  outcome: Outcome;
  /** Short team name: "Commanders", "49ers". */
  short: string;
  pickers: SidePicker[];
  points: number;
  won: boolean;
  ring: RingTone;
}

export interface GameView {
  game: PoolGame;
  away: SideView;
  home: SideView;
  locked: boolean;
  decided: boolean;
  missed: (Person | undefined)[];
  /** The viewer's pick, when visible. */
  mine: { outcomeId: string; confidence: number } | null;
}

export function shortTeam(o: Outcome): string {
  const words = o.name.trim().split(/\s+/);
  return words[words.length - 1] || o.abbrev;
}

/** Everything a game card and its detail panel need, in away/home order. */
export function gameView(
  game: PoolGame,
  index: PoolIndex,
  people: Map<string, Person>,
  meId: string,
): GameView {
  const agg = aggregateGame(game, index);
  const decided = game.correctOutcomeIds.length > 0;
  const minePick = index.picksByEntry.get(meId)?.get(game.propId) ?? null;
  const mine = minePick ? { outcomeId: minePick.outcomeId, confidence: minePick.confidence } : null;

  const sides = agg.byOutcome.map((o): SideView => {
    const won = decided && game.correctOutcomeIds.includes(o.outcome.outcomeId);
    const isMine = mine?.outcomeId === o.outcome.outcomeId;
    return {
      outcome: o.outcome,
      short: shortTeam(o.outcome),
      pickers: o.pickers.map((p) => ({
        entryId: p.entryId,
        person: people.get(p.entryId),
        confidence: p.confidence,
      })),
      points: o.confidencePoints,
      won,
      ring: !isMine ? null : !decided ? "pending" : won ? "win" : "loss",
    };
  });
  const homeFirst = sides[0]?.outcome.homeAway === "home";
  const [away, home] = homeFirst ? [sides[1], sides[0]] : [sides[0], sides[1]];

  const picked = new Set(agg.byOutcome.flatMap((o) => o.pickers.map((p) => p.entryId)));
  const locked = isLocked(game, index);
  const missed = locked
    ? index.entries.filter((e) => !picked.has(e.entryId)).map((e) => people.get(e.entryId))
    : [];

  return { game, away, home, locked, decided, missed, mine };
}

export function kickoffLabel(ms: number | null): string {
  if (ms === null) return "TBD";
  return new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** ESPN model favourite, e.g. { team: "Chiefs", pct: 78 }. */
export function modelFavorite(v: GameView): { team: string; pct: number } | null {
  const a = v.away.outcome.bpiWinProb;
  const h = v.home.outcome.bpiWinProb;
  if (a === null || h === null) return null;
  return a >= h ? { team: v.away.short, pct: Math.round(a) } : { team: v.home.short, pct: Math.round(h) };
}
