"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { LeagueGate, useLeagueParam } from "@/components/LeagueGate";
import { WeekSelector } from "@/components/WeekSelector";
import {
  Btn,
  Card,
  Control,
  ErrorPanel,
  SectionHead,
  StatusPill,
  TeamBadge,
  readableColor,
} from "@/components/ui";
import { useIdentity, usePool, usePoolIndex } from "@/lib/hooks";
import { aggregateGame } from "@/lib/pool/aggregate";
import { simulate, type Scenario } from "@/lib/pool/simulate";
import type { PoolGame, RankedEntry } from "@/lib/types";

export default function WhatIfPage() {
  return (
    <Suspense fallback={<p className="py-16 text-sm text-[var(--muted)]">Loading…</p>}>
      <LeagueGate>
        <WhatIf />
      </LeagueGate>
    </Suspense>
  );
}

function WhatIf() {
  const { leagueId } = useLeagueParam();
  const { data: pool, error, isLoading, isFetching, refetch } = usePool(leagueId);
  const index = usePoolIndex(pool);
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [weekParam, setWeekParam] = useState<number | null>(null);
  const week = weekParam ?? pool?.meta.currentWeek ?? 1;
  const identity = useIdentity();
  const me = identity.name
    ? (pool?.entries.find(
        (e) => e.displayName.toLowerCase() === identity.name!.toLowerCase(),
      )?.entryId ?? null)
    : null;

  // Scenario lives in the URL so a projection can be shared.
  const scenario: Scenario = useMemo(() => {
    const out: Scenario = {};
    if (!search) return out;
    for (const [k, v] of search.entries()) {
      if (k.startsWith("g:")) out[k.slice(2)] = v;
    }
    return out;
  }, [search]);

  /**
   * The scenario is written to the URL so a projection can be shared. It goes
   * through `router.replace` rather than `history.replaceState` so
   * `useSearchParams` stays in sync; a raw history call would update the
   * address bar without re-rendering.
   */
  const setScenario = useCallback(
    (next: Scenario) => {
      const params = new URLSearchParams(window.location.search);
      for (const k of [...params.keys()]) {
        if (k.startsWith("g:")) params.delete(k);
      }
      for (const [propId, outcomeId] of Object.entries(next)) {
        params.set(`g:${propId}`, outcomeId);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const games = useMemo(
    () => (index ? (index.gamesByWeek.get(week) ?? []) : []),
    [index, week],
  );
  const aggs = useMemo(
    () => (index ? games.map((g) => aggregateGame(g, index)) : []),
    [index, games],
  );

  const result = useMemo(
    () => (pool && index ? simulate(pool, { week, scenario }) : null),
    [pool, index, week, scenario],
  );

  if (isLoading || !leagueId) {
    return <p className="py-16 text-sm text-[var(--muted)]">Loading league…</p>;
  }
  if (error) return <ErrorPanel error={error as Error} />;
  if (!pool || !index || !result) return null;

  const undecided = aggs.filter((a) => a.undecided);
  const flipped = aggs.filter((a) => {
    const override = scenario[a.game.propId];
    return override && override !== a.game.correctOutcomeIds[0];
  });
  const tiebreak = pool.meta.tiebreaks.find((t) => t.week === week);

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            What if · {pool.meta.groupName}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[var(--faint)]">
            Set winners for any game and see where the standings land. Games with
            a result can be flipped to backtest a decision.
          </p>
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
            className="min-w-0 flex-1 sm:max-w-[190px] sm:flex-none"
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
            {isFetching ? "refreshing…" : "live data"}
          </span>
        </div>
        <WeekSelector
          weeks={pool.meta.weeks}
          value={week}
          onChange={setWeekParam}
        />
      </header>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
          Presets
        </span>
        <PresetButton onClick={() => setScenario({})}>Actual</PresetButton>
        <PresetButton onClick={() => setScenario(consensusScenario(aggs))}>
          Consensus
        </PresetButton>
        <PresetButton onClick={() => setScenario(modelScenario(aggs))}>
          Favourites
        </PresetButton>
        <PresetButton onClick={() => setScenario(dogScenario(aggs))}>
          Underdogs
        </PresetButton>
        <PresetButton onClick={() => setScenario(randomScenario(aggs))}>
          Random
        </PresetButton>
        {Object.keys(scenario).length > 0 ? (
          <PresetButton onClick={() => setScenario({})}>Reset</PresetButton>
        ) : null}
        <span className="w-full text-[11px] text-[var(--faint)] sm:ml-auto sm:w-auto">
          {flipped.length > 0
            ? `${flipped.length} decided game${flipped.length === 1 ? "" : "s"} overridden`
            : undecided.length > 0
              ? `${undecided.length} undecided game${undecided.length === 1 ? "" : "s"} set so far`
              : "all games decided"}
        </span>
      </Card>

      {tiebreak && week >= pool.meta.currentWeek ? (
        <p className="text-[11px] leading-relaxed text-[var(--faint)]">
          Weekly tiebreak: <span className="text-[var(--muted)]">{tiebreak.question}</span>{" "}
          — Ties in the weekly table are shown as ties; ESPN resolves them with
          this answer once the games finish.
        </p>
      ) : null}

      <SelfCheck result={result} />

      {/* minmax(0,1fr) on the single column is load-bearing: a bare `auto`
          track resolves to its content's min-content width, so the 340px
          standings table would stretch the page instead of scrolling. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:gap-6 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-3">
          <SectionHead title="Game outcomes" hint="pick a winner" />
          {aggs.map((agg) => (
            <OutcomeToggle
              key={agg.game.propId}
              agg={agg}
              value={scenario[agg.game.propId] ?? agg.game.correctOutcomeIds[0]}
              isOverride={
                scenario[agg.game.propId] !== undefined &&
                scenario[agg.game.propId] !== agg.game.correctOutcomeIds[0]
              }
              onChange={(outcomeId) =>
                setScenario({ ...scenario, [agg.game.propId]: outcomeId })
              }
              onClear={() => {
                const next = { ...scenario };
                delete next[agg.game.propId];
                setScenario(next);
              }}
            />
          ))}
        </section>

        <section className="space-y-5 sm:space-y-6">
          <StandingsTable
            title={`Week ${week} standings`}
            caption="Projected score for the simulated week only. Max is the most this entry can still reach."
            rows={result.weekly}
            highlightEntryId={me}
          />
          <StandingsTable
            title="Season totals"
            caption="Completed weeks keep ESPN's actual results; the simulated week is recomputed. Max adds the reachable points still on the table."
            rows={result.season}
            highlightEntryId={me}
          />
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PresetButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--accent)]"
    >
      {children}
    </button>
  );
}

function SelfCheck({ result }: { result: ReturnType<typeof simulate> }) {
  return (
    <Card
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-[11px] ${
        result.selfCheckPassed
          ? "border-[color-mix(in_oklab,var(--positive)_40%,var(--line))]"
          : "border-[color-mix(in_oklab,var(--negative)_50%,var(--line))]"
      }`}
    >
      <span
        className={`font-semibold ${
          result.selfCheckPassed ? "text-[var(--positive)]" : "text-[var(--negative)]"
        }`}
      >
        {result.selfCheckPassed
          ? "✓ engine verified against ESPN"
          : "✗ engine disagrees with ESPN"}
      </span>
      {result.selfCheckPassed ? (
        <span className="text-[var(--faint)]">
          Recomputing every member&apos;s week from their raw picks reproduces
          ESPN&apos;s reported scores, ranks, and maximum-possible points.
        </span>
      ) : (
        <span className="text-[var(--faint)]">
          {result.selfCheckFailures.slice(0, 4).join(" · ")}
        </span>
      )}
    </Card>
  );
}

function OutcomeToggle({
  agg,
  value,
  isOverride,
  onChange,
  onClear,
}: {
  agg: ReturnType<typeof aggregateGame>;
  value: string | null;
  isOverride: boolean;
  onChange: (outcomeId: string) => void;
  onClear: () => void;
}) {
  const { game } = agg;
  return (
    <Card className={`p-3 transition-colors ${isOverride ? "border-[var(--accent)]" : ""}`}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="num min-w-0 flex-1 truncate text-xs text-[var(--muted)]">
          {game.order + 1}. {game.name}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusPill game={game} />
          {isOverride ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-[var(--accent)] hover:underline"
            >
              reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {game.outcomes.map((o) => {
          const selected = value === o.outcomeId;
          const isActual = game.correctOutcomeIds[0] === o.outcomeId;
          const color = readableColor(o.color, "var(--away-fallback)");
          const share = agg.byOutcome.find(
            (x) => x.outcome.outcomeId === o.outcomeId,
          );
          return (
            <button
              key={o.outcomeId}
              type="button"
              onClick={() => onChange(o.outcomeId)}
              className={`flex min-h-14 min-w-0 items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors ${
                selected
                  ? "border-[var(--accent)] bg-[var(--surface-3)]"
                  : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--faint)]"
              }`}
            >
              <TeamBadge abbrev={o.abbrev} logo={o.logo} color={o.color} size={20} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <span className="truncate">{o.abbrev}</span>
                  {o.score !== null ? (
                    <span className="num text-[var(--muted)]">{o.score}</span>
                  ) : null}
                  {isActual ? (
                    <span className="text-[10px] text-[var(--positive)]">actual</span>
                  ) : null}
                </span>
                {share ? (
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-0)]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${share.share * 100}%`, background: color }}
                    />
                  </span>
                ) : null}
              </span>
              <span className="num shrink-0 text-[11px] text-[var(--faint)]">
                {share ? `${Math.round(share.share * 100)}%` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function StandingsTable({
  title,
  caption,
  rows,
  highlightEntryId,
}: {
  title: string;
  caption: string;
  rows: RankedEntry[];
  highlightEntryId: string | null;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <SectionHead title={title} />
      {/* The scroller caps the table's min-content; min-w-0 on this wrapper
          stops the 340px table from widening the page on narrow screens. */}
      <Card className="scroller min-w-0">
        <table className="w-full min-w-[300px] text-sm sm:min-w-[340px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-[11px] uppercase tracking-wider text-[var(--faint)]">
              <th className="px-2 py-2 text-left font-medium sm:px-3">Rank</th>
              <th className="px-2 py-2 text-left font-medium sm:px-3">Member</th>
              <th className="px-2 py-2 text-right font-medium sm:px-3">Projected</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                Now
              </th>
              <th className="px-2 py-2 text-right font-medium sm:px-3">Change</th>
              <th
                className="px-2 py-2 text-right font-medium sm:px-3"
                title="Best score still reachable under this scenario"
              >
                Max
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const scoreDelta = r.score - r.prevScore;
              const isMe = highlightEntryId === r.entryId;
              return (
                <tr
                  key={r.entryId}
                  className={`border-b border-[var(--line)]/60 last:border-0 ${
                    isMe ? "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]" : ""
                  }`}
                >
                  <td className="num whitespace-nowrap px-2 py-2 font-semibold sm:px-3 sm:py-1.5">
                    {r.rank}
                    {r.delta !== 0 ? (
                      <span
                        className={`ml-1 text-[11px] ${
                          r.delta > 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"
                        }`}
                      >
                        {r.delta > 0 ? "▲" : "▼"}
                        {Math.abs(r.delta)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-1.5">
                    <span
                      className={`block max-w-[9rem] truncate sm:max-w-none ${
                        isMe ? "font-semibold" : ""
                      }`}
                    >
                      {r.displayName}
                    </span>
                  </td>
                  <td className="num px-2 py-2 text-right font-semibold sm:px-3 sm:py-1.5">
                    {r.score}
                  </td>
                  <td className="num hidden px-3 py-1.5 text-right text-[var(--muted)] sm:table-cell">
                    {r.prevScore}
                  </td>
                  <td
                    className={`num whitespace-nowrap px-2 py-2 text-right sm:px-3 sm:py-1.5 ${
                      scoreDelta > 0
                        ? "text-[var(--positive)]"
                        : scoreDelta < 0
                          ? "text-[var(--negative)]"
                          : "text-[var(--faint)]"
                    }`}
                  >
                    {scoreDelta > 0 ? "+" : ""}
                    {scoreDelta}
                  </td>
                  <td className="num px-2 py-2 text-right text-[var(--faint)] sm:px-3 sm:py-1.5">
                    {r.possiblePointsMax}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-[11px] leading-relaxed text-[var(--faint)]">{caption}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Presets
 * ------------------------------------------------------------------ */

type Agg = ReturnType<typeof aggregateGame>;

function consensusScenario(aggs: Agg[]): Scenario {
  const out: Scenario = {};
  for (const agg of aggs) {
    const best = [...agg.byOutcome].sort((a, b) => b.picks - a.picks)[0];
    if (best) out[agg.game.propId] = best.outcome.outcomeId;
  }
  return out;
}

function modelScenario(aggs: Agg[]): Scenario {
  const out: Scenario = {};
  for (const agg of aggs) {
    const scored = agg.byOutcome
      .map((o) => ({ id: o.outcome.outcomeId, v: o.outcome.bpiWinProb }))
      .filter((x): x is { id: string; v: number } => x.v !== null);
    const best = scored.length
      ? scored.reduce((a, b) => (b.v > a.v ? b : a))
      : null;
    if (best) out[agg.game.propId] = best.id;
  }
  return out;
}

function dogScenario(aggs: Agg[]): Scenario {
  const out: Scenario = {};
  for (const agg of aggs) {
    const scored = agg.byOutcome
      .map((o) => ({ id: o.outcome.outcomeId, v: o.outcome.bpiWinProb }))
      .filter((x): x is { id: string; v: number } => x.v !== null);
    const best = scored.length ? scored.reduce((a, b) => (a.v > b.v ? a : b)) : null;
    if (best) out[agg.game.propId] = best.id;
  }
  return out;
}

function randomScenario(aggs: Agg[]): Scenario {
  const out: Scenario = {};
  for (const agg of aggs) {
    const options: PoolGame["outcomes"] = agg.game.outcomes;
    if (options.length === 0) continue;
    out[agg.game.propId] =
      options[Math.floor(Math.random() * options.length)].outcomeId;
  }
  return out;
}
