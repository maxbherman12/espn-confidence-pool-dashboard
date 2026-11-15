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

type Preset = "actual" | "crowd" | "mine" | null;

function WhatIf({ pool, index, people, meId }: PoolContext) {
  const [week, setWeek] = useState(pool.meta.currentWeek);
  const [scenario, setScenario] = useState<Scenario>({});
  const [preset, setPreset] = useState<Preset>("actual");

  const games = useMemo(() => index.gamesByWeek.get(week) ?? [], [index, week]);
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
    if (p !== "actual") {
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

  // Positions for the animated leaderboard: top five, then you if you're lower.
  const order = result.weekly.map((r) => r.entryId);
  const mine = result.weekly.find((r) => r.entryId === meId)!;
  const myPos = order.indexOf(meId);
  const height = (myPos >= TOP ? TOP + 1 : TOP) * ROW + (myPos >= TOP ? 10 : 0);

  return (
    <>
      <PageHeader
        eyebrow={`Week ${week} · tap who wins`}
        title="What if…"
        right={<WeekPicker weeks={pool.meta.weeks} value={week} onChange={changeWeek} />}
      />
      <div className="flex gap-2 overflow-x-auto px-4 pb-2.5 pt-1.5">
        <Chip active={preset === "actual"} onClick={() => applyPreset("actual")}>What happened</Chip>
        <Chip active={preset === "crowd"} onClick={() => applyPreset("crowd")}>Group favorites</Chip>
        <Chip active={preset === "mine"} onClick={() => applyPreset("mine")}>My picks win</Chip>
      </div>

      <section className="card mx-4 p-3">
        <div className="flex items-baseline justify-between px-1 pb-2">
          <span className="text-[15px] font-bold">Week {week} standings</span>
          <span className="text-[13px] font-semibold text-accent">
            You: {ordinal(mine.rank)} · {mine.score}
          </span>
        </div>
        <div className="relative" style={{ height }}>
          {result.weekly.map((r, pos) => {
            const me = r.entryId === meId;
            const show = pos < TOP || me;
            const top = pos < TOP ? pos * ROW : me ? TOP * ROW + 10 : (TOP + 1) * ROW + 20;
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
                <span className="w-10 text-right text-base font-bold">{r.score}</span>
              </motion.div>
            );
          })}
        </div>
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
          return (
            <li key={g.propId} className={`flex min-h-14 items-center gap-2 ${i ? "border-t border-line" : ""}`}>
              <div className={`grid flex-1 grid-cols-2 gap-1 rounded-xl p-[3px] ${flipped ? "bg-accent-soft" : "bg-soft"}`}>
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
                    </button>
                  );
                })}
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
