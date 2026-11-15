"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { PoolScreen, type PoolContext } from "@/components/PoolScreen";
import { AnimatedNumber, PageHeader, ordinal } from "@/components/ui";
import { competitionRanks } from "@/lib/pool/rank";
import { seasonThrough, weekScore } from "@/lib/pool/standings";
import { weekSummary } from "@/lib/pool/summary";

export default function SeasonPage() {
  return <PoolScreen>{(ctx) => <Season {...ctx} />}</PoolScreen>;
}

interface WeekStat {
  week: number;
  score: number;
  /** Finish within that week alone. */
  weekRank: number;
  /** Season place after the week. */
  seasonRank: number;
  /** Points behind first place after the week. */
  gap: number;
  average: number;
}

function Season({ pool, index, people, meId }: PoolContext) {
  const me = pool.entries.find((e) => e.entryId === meId)!;
  const field = pool.entries.length;

  const stats = useMemo<WeekStat[]>(() => {
    const done = pool.meta.weeks.filter((w) => w.status === "COMPLETE");
    return done.map((w) => {
      const weekly = pool.entries.map((e) => weekScore(e, w.id));
      const season = pool.entries.map((e) => seasonThrough(e, w.id));
      const i = pool.entries.indexOf(me);
      return {
        week: w.id,
        score: weekly[i],
        weekRank: competitionRanks(weekly)[i],
        seasonRank: competitionRanks(season)[i],
        gap: Math.max(...season) - season[i],
        average: weekSummary(pool, index, w.id).average,
      };
    });
  }, [pool, index, me]);

  const last = stats[stats.length - 1];
  const best = stats.reduce<WeekStat | null>((b, s) => (!b || s.score > b.score ? s : b), null);
  const beat = stats.filter((s) => s.score > s.average).length;
  const maxGap = Math.max(1, ...stats.map((s) => s.gap));
  const person = people.get(meId)!;

  if (!last) {
    return (
      <>
        <PageHeader eyebrow={person.name} title="Season" />
        <p className="card mx-4 px-5 py-8 text-center text-sm text-muted">
          Your season shows up here once the first week is final.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow={`${person.name} · ${stats.length} weeks played`} title="Season" />

      <section className="card mx-4 mt-1.5 p-4">
        <h2 className="text-[17px] font-bold">How far behind 1st place</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          {last.gap === 0
            ? "You're in first. Shorter bar = closer to the lead."
            : `Shorter bar = closer to the lead. Now ${last.gap} back.`}
        </p>
        <div className="relative mt-6 border-t-2 border-ink">
          <span className="absolute -top-5 right-0 text-[11px] font-bold">1st place</span>
          <div className="flex h-[150px] items-start gap-1.5 pt-0.5" role="img" aria-label={`Points behind first after each week: ${stats.map((s) => s.gap).join(", ")}`}>
            {stats.map((s, i) => (
              <div key={s.week} className="flex min-w-0 flex-1 flex-col items-center">
                <motion.div
                  className="w-full origin-top rounded-b-md"
                  style={{
                    height: Math.max(3, (s.gap / maxGap) * 120),
                    background: i === stats.length - 1 ? "var(--accent)" : "var(--accent-track)",
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                />
                <span className="mt-1 text-[11px] font-bold">{s.gap}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 text-[11px] text-faint">
          {stats.map((s) => (
            <span key={s.week} className="min-w-0 flex-1 text-center">W{s.week}</span>
          ))}
        </div>
      </section>

      <section className="card mx-4 mt-3 p-4">
        <h2 className="text-[17px] font-bold">Where you finished each week</h2>
        <p className="mt-0.5 text-[13px] text-muted">Out of {field}. Green = top 5.</p>
        <div className="mt-3.5 grid grid-cols-6 gap-y-3 sm:grid-cols-9">
          {stats.map((s, i) => {
            const good = s.weekRank <= 5;
            return (
              <div key={s.week} className="flex flex-col items-center gap-1">
                <motion.span
                  className={`flex size-8 items-center justify-center rounded-full text-[13px] font-bold ${good ? "bg-win text-white" : "bg-soft"}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.2 + i * 0.05 }}
                >
                  {s.weekRank}
                </motion.span>
                <span className="text-[11px] text-faint">W{s.week}</span>
                <span className="text-[11px] font-semibold">{s.score}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        <Tile label="Place now" value={ordinal(last.seasonRank)} suffix={`of ${field}`} />
        <Tile label="Best week" value={best?.score ?? 0} suffix={best ? `W${best.week}` : ""} />
        <Tile label="Beat the group avg" value={beat} suffix={`of ${stats.length} weeks`} />
        <Tile
          label="Season total"
          value={me.espn.overallScore}
          suffix="pts"
        />
      </div>
    </>
  );
}

function Tile({ label, value, suffix }: { label: string; value: number | string; suffix: string }) {
  return (
    <div className="card rounded-[18px] p-3.5">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="text-[26px] font-extrabold tracking-[-0.5px]">
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        <span className="ml-1 text-[13px] font-semibold text-faint">{suffix}</span>
      </div>
    </div>
  );
}
