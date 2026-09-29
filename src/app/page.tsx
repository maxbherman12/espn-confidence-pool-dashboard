"use client";

import { Suspense, useMemo, useState } from "react";
import { ConfidenceHeatmap } from "@/components/charts/ConfidenceHeatmap";
import { GameRow } from "@/components/GameRow";
import { LeagueGate, useLeagueParam } from "@/components/LeagueGate";
import { SeasonTrend } from "@/components/SeasonTrend";
import { WeekSelector } from "@/components/WeekSelector";
import {
  Btn,
  Card,
  Control,
  ErrorPanel,
  SectionHead,
  Stat,
} from "@/components/ui";
import {
  relativeAge,
  useIdentity,
  useNow,
  usePool,
  usePoolIndex,
} from "@/lib/hooks";
import { aggregateWeek } from "@/lib/pool/aggregate";
import { weekSummary } from "@/lib/pool/summary";

export default function InsightsPage() {
  return (
    <Suspense fallback={<p className="py-16 text-sm text-[var(--muted)]">Loading…</p>}>
      <LeagueGate>
        <Insights />
      </LeagueGate>
    </Suspense>
  );
}

function Insights() {
  const { leagueId } = useLeagueParam();
  const { data: pool, error, isLoading, isFetching, refetch } = usePool(leagueId);
  const index = usePoolIndex(pool);
  const now = useNow();
  const identity = useIdentity();
  const [weekOverride, setWeekOverride] = useState<number | null>(null);

  const activeWeek = weekOverride ?? pool?.meta.currentWeek ?? 1;
  const weekAgg = useMemo(
    () => (index ? aggregateWeek(activeWeek, index) : null),
    [index, activeWeek],
  );
  const summary = useMemo(
    () => (pool && index ? weekSummary(pool, index, activeWeek) : null),
    [pool, index, activeWeek],
  );

  if (isLoading || !leagueId) {
    return <p className="py-16 text-sm text-[var(--muted)]">Loading league…</p>;
  }
  if (error) return <ErrorPanel error={error as Error} />;
  if (!pool || !index || !weekAgg || !summary) return null;

  const { meta } = pool;
  const me = identity.name
    ? (pool.entries.find(
        (e) => e.displayName.toLowerCase() === identity.name!.toLowerCase(),
      )?.entryId ?? null)
    : null;
  const weekLabel = meta.weeks.find((w) => w.id === activeWeek)?.label ?? "";

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            {meta.groupName}
          </h1>
          <p className="mt-1 text-xs text-[var(--faint)]">
            {meta.challengeName} · {meta.scoringFormatLabel} · {meta.groupSize} entries
          </p>
          {meta.warnings.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {meta.warnings.map((w) => (
                <li key={w} className="text-[11px] text-[var(--warn)]">
                  ⚠ {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="identity"
            className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]"
          >
            I am
          </label>
          <Control
            id="identity"
            value={identity.name ?? ""}
            onChange={(e) => identity.setName(e.target.value || null)}
            className="min-w-0 flex-1 sm:max-w-[200px] sm:flex-none"
          >
            <option value="">not set</option>
            {pool.entries.map((e) => (
              <option key={e.entryId} value={e.displayName}>
                {e.displayName}
              </option>
            ))}
          </Control>
          <Btn onClick={() => void refetch()} className="ml-auto sm:ml-0">
            Refresh
          </Btn>
          <span className="w-full text-[11px] text-[var(--faint)] sm:w-auto">
            {isFetching ? "refreshing…" : relativeAge(meta.fetchedAt, now)}
          </span>
        </div>
      </header>

      <WeekSelector weeks={meta.weeks} value={activeWeek} onChange={setWeekOverride} />

      <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:gap-5">
        <Stat
          label={`Average · ${weekLabel}`}
          value={summary.empty ? "—" : summary.average.toFixed(1)}
          sub={
            summary.empty
              ? "no picks submitted yet"
              : `points, ${summary.participants} participating`
          }
        />
        <Stat
          label="First this week"
          value={summary.leader ? truncate(summary.leader.displayName, 18) : "—"}
          sub={summary.leader ? `${summary.leader.score} points` : undefined}
          tone={summary.leader ? "positive" : "default"}
        />
        <Stat
          label="Last this week"
          value={summary.last ? truncate(summary.last.displayName, 18) : "—"}
          sub={summary.last ? `${summary.last.score} points` : undefined}
          tone={summary.last ? "negative" : "default"}
        />
      </Card>

      <section className="space-y-3">
        <SectionHead
          title="Pick distribution"
          hint="bar width is the share of members on each side — tap one for who backed it"
        />
        {weekAgg.games.map((agg) => (
          <GameRow key={agg.game.propId} agg={agg} highlightEntryId={me} />
        ))}
      </section>

      <section className="space-y-3">
        <SectionHead title="Confidence heatmap" hint={`every member for ${weekLabel}`} />
        <Card className="p-3 sm:p-4">
          <ConfidenceHeatmap
            games={weekAgg.games.map((g) => g.game)}
            entries={pool.entries}
            index={index}
            week={activeWeek}
            highlightEntryId={me}
          />
        </Card>
      </section>

      <SeasonTrend pool={pool} index={index} />
    </div>
  );
}

function truncate(value: string, n: number): string {
  return value.length > n ? `${value.slice(0, n - 1)}…` : value;
}
