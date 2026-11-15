"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { LockIcon } from "@/components/games/GameCard";
import { shortTeam } from "@/components/games/gameView";
import { PoolScreen, type PoolContext } from "@/components/PoolScreen";
import { Avatar, Chip, PageHeader, WeekPicker, ordinal } from "@/components/ui";
import { isLocked } from "@/lib/pool/possible";
import { simulate, type Scenario } from "@/lib/pool/simulate";
import type { PoolGame } from "@/lib/types";

export default function WhatIfPage() {
  return <PoolScreen>{(ctx) => <WhatIf {...ctx} />}</PoolScreen>;
}

const TOP = 5;
const ROW = 40;

type Preset = "actual" | "leaders" | "crowd" | "mine" | null;

/**
 * The team ahead in a game that has started but has no official result yet.
 * Tied or unscored games have no leader.
 */
function leaderOf(g: PoolGame): string | null {
  if (g.status === "PENDING" || g.correctOutcomeIds.length > 0) return null;
  const [a, b] = g.outcomes;
  if (!a || !b || a.score === null || b.score === null || a.score === b.score) return null;
  return a.score > b.score ? a.outcomeId : b.outcomeId;
}

/** Completed results stand; every game in progress goes to whoever is ahead. */
function leadersScenario(games: PoolGame[]): Scenario {
  const out: Scenario = {};
  for (const g of games) {
    const lead = leaderOf(g);
    if (lead) out[g.propId] = lead;
  }
  return out;
}

function WhatIf({ pool, index, people, meId }: PoolContext) {
  const [week, setWeek] = useState(pool.meta.currentWeek);
  const [manual, setScenario] = useState<Scenario>({});
  const [preset, setPreset] = useState<Preset>("actual");
  const [expanded, setExpanded] = useState(false);

  const games = useMemo(() => index.gamesByWeek.get(week) ?? [], [index, week]);
  // "Current leaders" follows live scores as they refresh instead of freezing
  // the moment it was tapped.
  const scenario = useMemo(
    () => (preset === "leaders" ? leadersScenario(games) : manual),
    [preset, games, manual],
  );
  const result = useMemo(() => simulate(pool, { week, scenario }), [pool, week, scenario]);
  const myPicks = index.picksByEntry.get(meId);
  const hiddenGames = games.filter((g) => !isLocked(g, index)).length;

  const changeWeek = (w: number) => {
    setWeek(w);
    setScenario({});
    setPreset("actual");
  };

  const winnerOf = (g: PoolGame) => scenario[g.propId] ?? g.correctOutcomeIds[0] ?? null;

  const pick = (g: PoolGame, outcomeId: string) => {
    const next = { ...scenario };
    const actual = g.correctOutcomeIds[0];
    if (winnerOf(g) === outcomeId && !actual) delete next[g.propId];
    else if (outcomeId === actual) delete next[g.propId];
    else next[g.propId] = outcomeId;
    setScenario(next);
    setPreset(null);
  };

  const applyPreset = (p: Exclude<Preset, null>) => {
    const next: Scenario = {};
    if (p === "crowd" || p === "mine") {
      for (const g of games) {
        const choice = p === "crowd" ? crowdFavorite(g) : myPicks?.get(g.propId)?.outcomeId;
        if (choice && choice !== g.correctOutcomeIds[0]) next[g.propId] = choice;
      }
    }
    setScenario(next);
    setPreset(p);
  };

  function crowdFavorite(g: PoolGame): string | null {
    const counts = new Map<string, number>();
    for (const picks of index.picksByEntry.values()) {
      const p = picks.get(g.propId);
      if (p) counts.set(p.outcomeId, (counts.get(p.outcomeId) ?? 0) + 1);
    }
    if (counts.size) return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const byModel = [...g.outcomes].sort((a, b) => (b.bpiWinProb ?? 0) - (a.bpiWinProb ?? 0));
    return byModel[0]?.bpiWinProb !== null ? byModel[0].outcomeId : null;
  }

  // Positions for the animated leaderboard. Collapsed: top five, then you if
  // you're lower. Expanded: everyone.
  const order = result.weekly.map((r) => r.entryId);
  const mine = result.weekly.find((r) => r.entryId === meId)!;
  const myPos = order.indexOf(meId);
  const total = order.length;
  const canExpand = total > TOP + (myPos >= TOP ? 1 : 0);
  const open = expanded && canExpand;
  const collapsedHeight = (myPos >= TOP ? TOP + 1 : TOP) * ROW + (myPos >= TOP ? 10 : 0);
  const height = open ? total * ROW : collapsedHeight;
  const toggle = () => canExpand && setExpanded((v) => !v);

  return (
    <>
      <PageHeader
        eyebrow={`Week ${week} · tap who wins`}
        title="What if…"
        right={<WeekPicker weeks={pool.meta.weeks} value={week} onChange={changeWeek} />}
      />
      <div className="flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1.5">
        <Chip active={preset === "actual"} onClick={() => applyPreset("actual")}>What happened</Chip>
        <Chip active={preset === "leaders"} onClick={() => applyPreset("leaders")}>Current leaders</Chip>
        <Chip active={preset === "crowd"} onClick={() => applyPreset("crowd")}>Group favorites</Chip>
        <Chip active={preset === "mine"} onClick={() => applyPreset("mine")}>My picks win</Chip>
      </div>

      <section
        className={`card mx-4 p-3 ${canExpand ? "cursor-pointer" : ""}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        role={canExpand ? "button" : undefined}
        tabIndex={canExpand ? 0 : undefined}
        aria-expanded={canExpand ? open : undefined}
        aria-label={canExpand ? `Week ${week} standings. ${open ? "Show fewer" : "Show everyone"}` : undefined}
      >
        <div className="flex items-baseline justify-between px-1 pb-2">
          <span className="text-[15px] font-bold">Week {week} standings</span>
          <span className="text-[13px] font-semibold text-accent">
            You: {ordinal(mine.rank)} · {mine.score}
          </span>
        </div>
        <div className="flex items-center gap-2.5 px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
          <span className="flex-1" />
          <span className="w-10 text-right">Pts</span>
          <span className="w-10 text-right">Max</span>
        </div>
        <motion.div
          className="relative overflow-hidden"
          initial={false}
          animate={{ height }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
        >
          {result.weekly.map((r, pos) => {
            const me = r.entryId === meId;
            const show = open || pos < TOP || me;
            const top = open
              ? pos * ROW
              : pos < TOP
                ? pos * ROW
                : me
                  ? TOP * ROW + 10
                  : (TOP + 1) * ROW + 20;
            const delta = r.prevRank - r.rank;
            const person = people.get(r.entryId);
            return (
              <motion.div
                key={r.entryId}
                className={`absolute inset-x-0 flex items-center gap-2.5 rounded-xl px-1.5 ${me ? "bg-accent-soft" : ""}`}
                style={{ height: ROW - 4 }}
                initial={false}
                animate={{ top, opacity: show ? 1 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                aria-hidden={!show}
              >
                <span className="w-6 text-center text-sm font-bold text-muted">{r.rank}</span>
                <Avatar person={person ?? null} me={me} size={28} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {me ? "You" : person?.name}
                </span>
                <span className={`w-8 text-right text-[13px] font-bold ${delta > 0 ? "text-win" : "text-loss"}`}>
                  {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${-delta}` : ""}
                </span>
                <span className="w-10 text-right text-base font-bold tabular-nums">{r.score}</span>
                <span className="w-10 text-right text-sm font-semibold tabular-nums text-faint">
                  {r.possiblePointsMax}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
        {canExpand ? (
          <div className="flex items-center justify-center gap-1 pt-1.5 text-[13px] font-semibold text-muted">
            {open ? "Show less" : `Show all ${total}`}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
              className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        ) : null}
      </section>

      {hiddenGames > 0 ? (
        <p className="mx-5 mt-3 flex items-start gap-1.5 text-[13px] leading-snug text-muted">
          <span className="mt-0.5 shrink-0"><LockIcon /></span>
          {hiddenGames} game{hiddenGames === 1 ? " hasn't" : "s haven't"} kicked off. Those picks are
          hidden, so they can&apos;t move anyone yet.
        </p>
      ) : null}

      <ul className="card mx-4 mt-3 px-3 py-1">
        {games.map((g, i) => {
          const winner = winnerOf(g);
          const away = g.outcomes.find((o) => o.homeAway === "away") ?? g.outcomes[0];
          const home = g.outcomes.find((o) => o.homeAway === "home") ?? g.outcomes[1];
          const my = myPicks?.get(g.propId);
          const right = my && winner ? my.outcomeId === winner : null;
          const flipped = Boolean(scenario[g.propId]);
          const started = g.status !== "PENDING";
          const live = g.status === "IN_PROGRESS";
          return (
            <li key={g.propId} className={`flex min-h-14 items-center gap-2 py-1.5 ${i ? "border-t border-line" : ""}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className={`grid grid-cols-2 gap-1 rounded-xl p-[3px] ${flipped ? "bg-accent-soft" : "bg-soft"}`}>
                  {[away, home].map((o) => {
                    const on = winner === o.outcomeId;
                    return (
                      <button
                        key={o.outcomeId}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${shortTeam(o)} win`}
                        onClick={() => pick(g, o.outcomeId)}
                        className={`flex min-h-[42px] items-center justify-center gap-2 rounded-[10px] text-sm font-bold transition-all duration-200 ${
                          on ? "bg-card text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-faint"
                        }`}
                      >
                        {o.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.logo} alt="" width={24} height={24} className={`size-6 transition ${on ? "" : "opacity-50 grayscale"}`} />
                        ) : null}
                        {o.abbrev}
                        {started ? (
                          <span className="tabular-nums font-extrabold">{o.score ?? 0}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {started ? (
                  <div
                    className={`flex items-center justify-center gap-1 text-[11px] font-semibold ${
                      live ? "text-loss" : "text-faint"
                    }`}
                  >
                    {live ? <span className="size-1.5 animate-pulse rounded-full bg-loss" /> : null}
                    {live ? (g.statusDetail ?? "Live") : "Final"}
                  </div>
                ) : null}
              </div>
              <span
                className={`w-11 shrink-0 rounded-lg py-1 text-center text-[13px] font-bold ${
                  !my
                    ? "text-faint"
                    : right === null
                      ? "bg-soft text-ink"
                      : right
                        ? "bg-win-soft text-win"
                        : "bg-loss-soft text-loss"
                }`}
                aria-label={my ? `Your pick: ${my.confidence} points` : "No visible pick"}
              >
                {!my ? (isLocked(g, index) ? "—" : <span className="inline-flex"><LockIcon /></span>) : `${right ? "+" : ""}${my.confidence}`}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
