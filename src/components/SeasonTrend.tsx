"use client";

import { useMemo } from "react";
import { Card, SectionHead } from "@/components/ui";
import { aggregateGame, type PoolIndex } from "@/lib/pool/aggregate";
import type { PoolModel } from "@/lib/types";

interface Row {
  week: number;
  label: string;
  abbrev: string;
  status: PoolModel["meta"]["weeks"][number]["status"];
  games: number;
  avgScore: number;
  /** Mean |group share - national share| across the week's sides, in points. */
  divergence: number;
  decidedShare: number;
}

/**
 * Season-level view: how the group has scored each week, and how far its
 * consensus has sat from the national pool.
 */
export function SeasonTrend({
  pool,
  index,
}: {
  pool: PoolModel;
  index: PoolIndex;
}) {
  const rows = useMemo<Row[]>(
    () =>
      pool.meta.weeks.map((w) => {
        const games = index.gamesByWeek.get(w.id) ?? [];
        const scores = pool.entries.map(
          (e) => e.espn.byWeek[String(w.id)]?.score ?? 0,
        );
        const scored = scores.filter((s) => s > 0 || w.id <= pool.meta.currentWeek);
        const avg = scored.length
          ? scored.reduce((a, b) => a + b, 0) / scored.length
          : 0;

        let edgeSum = 0;
        let edgeN = 0;
        let decided = 0;
        for (const g of games) {
          const agg = aggregateGame(g, index);
          for (const o of agg.byOutcome) {
            if (o.edge === null) continue;
            edgeSum += Math.abs(o.edge);
            edgeN += 1;
          }
          if (!agg.undecided) decided += 1;
        }

        return {
          week: w.id,
          label: w.label,
          abbrev: w.abbrev,
          status: w.status,
          games: games.length,
          avgScore: avg,
          divergence: edgeN ? edgeSum / edgeN : 0,
          decidedShare: games.length ? (decided / games.length) * 100 : 0,
        };
      }),
    [pool, index],
  );

  const played = rows.filter((r) => r.week <= pool.meta.currentWeek);
  const maxAvg = Math.max(1, ...played.map((r) => r.avgScore));
  const maxDiv = Math.max(1, ...played.map((r) => r.divergence));
  const current = pool.meta.currentWeek;

  return (
    <section className="space-y-3">
      <SectionHead
        title="Season trend"
        hint="group average weekly score, and how far the group's consensus sat from the national pool"
      />
      <Card className="p-3 sm:p-4">
        <div className="scroller -mx-1 flex items-end gap-2 px-1 pb-1">
          {rows.map((r) => {
            const future = r.week > current;
            const h = (r.avgScore / maxAvg) * 112;
            const d = (r.divergence / maxDiv) * 112;
            return (
              <div
                key={r.week}
                className="flex w-9 shrink-0 flex-col items-center gap-1 sm:w-11"
                title={`${r.label}: avg ${r.avgScore.toFixed(1)} pts over ${r.games} games · ${r.divergence.toFixed(1)} pts from the national pool · ${r.decidedShare.toFixed(0)}% decided`}
              >
                <div className="flex h-28 w-full items-end justify-center gap-0.5">
                  <div
                    className="w-3 rounded-t bg-[var(--accent)]"
                    style={{ height: Math.max(2, h), opacity: future ? 0.25 : 1 }}
                  />
                  <div
                    className="w-1.5 rounded-t bg-[var(--warn)]"
                    style={{ height: Math.max(2, d), opacity: future ? 0.2 : 0.6 }}
                  />
                </div>
                <span
                  className={`num text-[10px] ${
                    r.week === current
                      ? "text-[var(--text)]"
                      : "text-[var(--faint)]"
                  }`}
                >
                  {r.abbrev}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--faint)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-3 rounded-sm bg-[var(--accent)]" />
            average weekly score
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-1.5 rounded-sm bg-[var(--warn)] opacity-60" />
            mean distance from the national pool
          </span>
        </div>
      </Card>
    </section>
  );
}
