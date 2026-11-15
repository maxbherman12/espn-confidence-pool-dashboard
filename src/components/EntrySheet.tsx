"use client";

import { useMemo, useState } from "react";
import { LockIcon } from "@/components/games/GameCard";
import { SeasonStats } from "@/components/SeasonStats";
import { Sheet } from "@/components/Sheet";
import { Avatar, ordinal } from "@/components/ui";
import type { Person } from "@/lib/name";
import type { PoolIndex } from "@/lib/pool/aggregate";
import { skippedValues } from "@/lib/pool/possible";
import { rootingGuide } from "@/lib/pool/rooting";
import type { StandingRow } from "@/lib/pool/standings";
import type { Outcome, PoolGame, PoolModel } from "@/lib/types";

export type EntryTab = "week" | "season";

type PickState = "hit" | "missed" | "pending" | "skipped" | "hidden";

interface PickCell {
  game: PoolGame;
  team: Outcome | null;
  opponent: Outcome | null;
  value: number | null;
  state: PickState;
}

/**
 * One person's overview: their week (score, max, projected finish, every pick)
 * and their season (gap to first, weekly finishes, tiles).
 */
export function EntrySheet({
  row,
  person,
  me,
  pool,
  index,
  week,
  total,
  initialTab,
  onClose,
}: {
  row: StandingRow | null;
  person: Person | undefined;
  me: boolean;
  pool: PoolModel;
  index: PoolIndex;
  week: number;
  total: number;
  /** Which tab to open on; follows the standings view it was opened from. */
  initialTab: EntryTab;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(row)} onClose={onClose} label={person ? `${person.name} overview` : "Overview"}>
      {row && person ? (
        <Body
          key={row.entryId}
          row={row}
          person={person}
          me={me}
          pool={pool}
          index={index}
          week={week}
          total={total}
          initialTab={initialTab}
        />
      ) : null}
    </Sheet>
  );
}

function Body({
  row,
  person,
  me,
  pool,
  index,
  week,
  total,
  initialTab,
}: {
  row: StandingRow;
  person: Person;
  me: boolean;
  pool: PoolModel;
  index: PoolIndex;
  week: number;
  total: number;
  initialTab: EntryTab;
}) {
  const [tab, setTab] = useState<EntryTab>(initialTab);
  return (
    <>
      <div className="flex items-center gap-3 px-5 pb-3 pt-3 pr-16">
        <Avatar person={person} me={me} size={44} />
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{me ? "You" : person.name}</div>
          <div className="truncate text-[13px] text-faint">@{person.username}</div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div role="tablist" aria-label="Overview" className="grid grid-cols-2 rounded-full bg-soft p-1">
          {(["week", "season"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-9 rounded-full text-[13px] font-semibold transition-colors ${
                tab === t ? "bg-card text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted"
              }`}
            >
              {t === "week" ? `Week ${week}` : "Season"}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-8">
        {tab === "week" ? (
          <WeekTab row={row} index={index} week={week} total={total} />
        ) : (
          <SeasonStats pool={pool} index={index} entryId={row.entryId} you={me} inset />
        )}
      </div>
    </>
  );
}

function WeekTab({
  row,
  index,
  week,
  total,
}: {
  row: StandingRow;
  index: PoolIndex;
  week: number;
  total: number;
}) {
  const cells = useMemo(() => pickCells(index, row.entryId, week), [index, row.entryId, week]);
  const projected = useMemo(
    () => rootingGuide(index, week, row.entryId).projectedRank,
    [index, week, row.entryId],
  );
  const open = cells.some((c) => c.state === "pending" || c.state === "hidden");

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Score" value={String(row.weekScore)} accent />
        <Stat label="Max" value={String(row.weekMax)} sub={`of ${row.ladder}`} />
        <Stat
          label={open ? "Projected" : "Finished"}
          value={ordinal(Math.round(projected))}
          sub={`of ${total}`}
        />
      </div>

      <div className="pt-4">
        <ul className="grid grid-cols-2 gap-2">
          {cells.map((c) => (
            <Cell key={c.game.propId} cell={c} />
          ))}
        </ul>
        <Legend />
        {open ? (
          <p className="mt-2 text-center text-[11px] leading-snug text-faint">
            Projected finish counts games in progress. Picks on games that haven&apos;t kicked off
            are hidden until kickoff.
          </p>
        ) : null}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-soft px-3 py-2.5 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div
        className={`text-[26px] font-extrabold leading-tight tracking-[-0.6px] tabular-nums ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] text-faint">{sub}</div> : null}
    </div>
  );
}

const BADGE: Record<PickState, string> = {
  hit: "bg-win-soft text-win",
  missed: "bg-loss-soft text-loss",
  pending: "bg-soft text-muted",
  hidden: "bg-soft text-muted",
  skipped: "bg-muted text-card",
};

function Cell({ cell }: { cell: PickCell }) {
  const { game, team, opponent, value, state } = cell;
  const live = game.status === "IN_PROGRESS";
  const away = game.outcomes.find((o) => o.homeAway === "away") ?? game.outcomes[0];
  const home = game.outcomes.find((o) => o.homeAway === "home") ?? game.outcomes[1];

  const title =
    state === "skipped" ? "No pick" : state === "hidden" ? `${away.abbrev} @ ${home.abbrev}` : team?.abbrev;
  const sub =
    state === "skipped"
      ? `${away.abbrev} @ ${home.abbrev}`
      : state === "hidden"
        ? "Hidden until kickoff"
        : `vs ${opponent?.abbrev ?? ""}${live ? " · Live" : ""}`;

  return (
    <li className="flex min-h-14 items-center gap-2 rounded-2xl border border-line px-2.5 py-2">
      {team?.logo && state !== "skipped" && state !== "hidden" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt=""
          width={28}
          height={28}
          className={`size-7 shrink-0 ${state === "missed" ? "opacity-60 grayscale" : ""}`}
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center text-faint">
          {state === "hidden" ? <LockIcon /> : "—"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{title}</div>
        <div className={`truncate text-[11px] ${live && state === "pending" ? "text-loss" : "text-faint"}`}>
          {sub}
        </div>
      </div>
      <span
        className={`min-w-9 shrink-0 rounded-lg px-1.5 py-1 text-center text-[13px] font-bold tabular-nums ${BADGE[state]}`}
        aria-label={label(state, value)}
      >
        {state === "hidden" ? "?" : value}
      </span>
    </li>
  );
}

function label(state: PickState, value: number | null): string {
  switch (state) {
    case "hit":
      return `Hit, ${value} points`;
    case "missed":
      return `Missed, ${value} points lost`;
    case "pending":
      return `${value} points riding`;
    case "skipped":
      return `Skipped, ${value} points burned`;
    case "hidden":
      return "Pick hidden";
  }
}

function Legend() {
  const items: [PickState, string][] = [
    ["hit", "Hit"],
    ["missed", "Missed"],
    ["pending", "Pending"],
    ["skipped", "Skipped"],
  ];
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-muted">
      {items.map(([s, text]) => (
        <span key={s} className="flex items-center gap-1.5">
          <i className={`size-2.5 rounded-[3px] ${BADGE[s].split(" ")[0]}`} />
          {text}
        </span>
      ))}
    </div>
  );
}

function pickCells(index: PoolIndex, entryId: string, week: number): PickCell[] {
  const games = index.gamesByWeek.get(week) ?? [];
  const picks = index.picksByEntry.get(entryId);
  const skipped = skippedValues(index, entryId, week);

  return games.map((game): PickCell => {
    const pick = picks?.get(game.propId);
    if (pick) {
      const team = game.outcomes.find((o) => o.outcomeId === pick.outcomeId) ?? null;
      const opponent = game.outcomes.find((o) => o.outcomeId !== pick.outcomeId) ?? null;
      const winner = game.correctOutcomeIds[0];
      const state: PickState = !winner ? "pending" : winner === pick.outcomeId ? "hit" : "missed";
      return { game, team, opponent, value: pick.confidence, state };
    }
    const burned = skipped.get(game.propId);
    if (burned !== undefined) {
      return { game, team: null, opponent: null, value: burned, state: "skipped" };
    }
    // Not revealed yet. A game that has kicked off but whose picks ESPN hasn't
    // shown is still hidden, not a skip.
    return { game, team: null, opponent: null, value: null, state: "hidden" };
  });
}
