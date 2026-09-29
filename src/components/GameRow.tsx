"use client";

import { ConfidenceHistogram } from "@/components/charts/ConfidenceHistogram";
import { SplitBar } from "@/components/charts/SplitBar";
import { Card, StatusPill, TeamBadge } from "@/components/ui";
import type { GameAgg, PoolGame } from "@/lib/types";

/** One game's distribution, confidence allocation, and points at stake. */
export function GameRow({
  agg,
  highlightEntryId,
}: {
  agg: GameAgg;
  highlightEntryId: string | null;
}) {
  const { game } = agg;
  const decided = game.correctOutcomeIds[0] ?? null;

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="num w-4 shrink-0 text-center text-[11px] text-[var(--faint)]">
            {game.order + 1}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            {game.outcomes.map((o) => (
              <span key={o.outcomeId} className="flex items-center gap-1.5">
                <TeamBadge abbrev={o.abbrev} logo={o.logo} color={o.color} size={20} />
                <span className="num text-sm font-semibold">
                  {o.abbrev}
                  {o.score !== null ? (
                    <span className="ml-1 font-normal text-[var(--muted)]">
                      {o.score}
                    </span>
                  ) : null}
                  {decided === o.outcomeId ? (
                    <span className="ml-0.5 text-[var(--positive)]">✓</span>
                  ) : null}
                </span>
              </span>
            ))}
            <span className="text-[var(--faint)]">@</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
          <StatusPill game={game} />
          {game.spread !== null ? (
            <span className="num">spread {fmtSpread(game.spread)}</span>
          ) : null}
          {game.overUnder !== null ? <span className="num">O/U {game.overUnder}</span> : null}
          <FavouriteTag game={game} />
          {agg.missed > 0 ? (
            <span className="num text-[var(--warn)]">{agg.missed} no pick</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <SplitBar agg={agg} highlightEntryId={highlightEntryId} />
      </div>

      <div className="mt-3">
        <ConfidenceHistogram agg={agg} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--faint)]">
        {game.outcomes.map((o) => {
          const pts = agg.pointsAtStake[o.outcomeId];
          const cash = agg.cashRate[o.outcomeId];
          return (
            <span key={o.outcomeId} className="num">
              <span className="text-[var(--muted)]">{o.abbrev}</span>{" "}
              {o.record ? `${o.record} · ` : ""}
              {pts === null || cash === null ? (
                <span className="text-[var(--warn)]">undecided</span>
              ) : (
                <>
                  {pts} pts at stake · {(cash * 100).toFixed(0)}% cashing
                </>
              )}
              {o.bpiWinProb !== null ? (
                <span className="text-[var(--faint)]"> · BPI {o.bpiWinProb.toFixed(0)}%</span>
              ) : null}
              {game.impliedWinProb?.[o.outcomeId] !== undefined ? (
                <span className="text-[var(--faint)]">
                  {" · "}
                  mkt {game.impliedWinProb[o.outcomeId].toFixed(0)}%
                </span>
              ) : null}
            </span>
          );
        })}
        {game.status === "COMPLETE" ? null : (
          <span className="text-[var(--faint)]">counts update as games finish</span>
        )}
      </div>
    </Card>
  );
}

function FavouriteTag({ game }: { game: PoolGame }) {
  const bpi = game.outcomes
    .map((o) => ({ abbrev: o.abbrev, v: o.bpiWinProb }))
    .filter((x): x is { abbrev: string; v: number } => x.v !== null);
  if (bpi.length === 0) return null;
  const top = bpi.reduce((a, b) => (b.v > a.v ? b : a));
  return (
    <span className="num">
      model favourite{" "}
      <span className="text-[var(--muted)]">
        {top.abbrev} {top.v.toFixed(0)}%
      </span>
    </span>
  );
}

function fmtSpread(spread: number): string {
  return spread > 0 ? `+${spread}` : String(spread);
}
