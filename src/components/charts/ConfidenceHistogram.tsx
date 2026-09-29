"use client";

import { readableColor } from "@/components/ui";
import type { GameAgg } from "@/lib/types";

/**
 * How the group distributed confidence values on one game.
 *
 * x-axis is the confidence ladder (1..ladderTop, the pool-wide range so every
 * game's chart is the same width and comparable); each rung shows how many
 * members assigned that value, split by the team they backed. Built from flex
 * slots rather than a stretched SVG so the rungs stay legible at phone widths.
 *
 * Rung numbers appear under the bars on desktop only; at phone widths 16 labels
 * would collide, so the axis degrades to its two endpoints.
 */
/**
 * Bar style for one rung. A single picker on a 21-member pool would otherwise
 * be 1/21 of the tallest bar, roughly 2px and effectively invisible, so non-zero
 * rungs get a small absolute floor. The floor is in pixels, not percent: as a
 * percentage it would resolve against the 48px track and shrink, not grow.
 */
function barHeight(
  count: number,
  maxCount: number,
  color: string,
): React.CSSProperties {
  if (count <= 0) return { height: 0, background: "transparent" };
  return {
    height: `${(count / maxCount) * 100}%`,
    minHeight: 5,
    background: color,
  };
}

export function ConfidenceHistogram({ agg }: { agg: GameAgg }) {
  const [a, b] = agg.byOutcome;
  if (!a || !b || agg.maxConfidence === 0) return null;

  const maxCount = Math.max(
    1,
    ...agg.histogram.flatMap((h) => Object.values(h.counts)),
  );
  const colorA = readableColor(a.outcome.color, "var(--away-fallback)");
  const colorB = readableColor(b.outcome.color, "var(--home-fallback)");

  return (
    <div>
      {/* items-stretch, not items-end: each rung needs the full 12-unit height
          as its containing block, otherwise the percentage heights below
          resolve against a 0px parent and every bar collapses to nothing. */}
      <div
        className="flex h-12 w-full items-stretch gap-px"
        role="img"
        aria-label={`Confidence allocation. ${a.outcome.abbrev} and ${b.outcome.abbrev} bars show how many members used each confidence value, from 1 to ${agg.ladderTop}.`}
      >
        {agg.histogram.map((h) => {
          const ca = h.counts[a.outcome.outcomeId] ?? 0;
          const cb = h.counts[b.outcome.outcomeId] ?? 0;
          return (
            <div
              key={h.confidence}
              className="flex min-w-0 flex-1 items-end gap-px"
            >
              <div
                className="min-w-0 flex-1 rounded-t-sm"
                style={barHeight(ca, maxCount, colorA)}
                title={`${h.confidence} pt · ${a.outcome.abbrev}: ${ca}`}
              />
              <div
                className="min-w-0 flex-1 rounded-t-sm"
                style={barHeight(cb, maxCount, colorB)}
                title={`${h.confidence} pt · ${b.outcome.abbrev}: ${cb}`}
              />
            </div>
          );
        })}
      </div>

      {/* Rung numbers, each with a tick at the rung's centre.
          Each rung is two half-width bars, so when only one side has a pick the
          visible bar sits half a rung away from its label. The tick gives the
          number a fixed anchor on the axis so it reads as centred on the rung
          rather than on the bar. `hidden sm:flex` keeps them off phones, where
          16 labels cannot fit; the endpoints still anchor the scale there. */}
      <div aria-hidden="true" className="mt-1 hidden gap-px sm:flex">
        {agg.histogram.map((h) => (
          <span
            key={h.confidence}
            className="num flex min-w-0 flex-1 flex-col items-center"
          >
            {/* --muted, not --line: at 1px the border colour is only 1.78:1
                against the card and disappears. --muted clears 4.5:1 while
                still reading as a quiet axis mark. */}
            <span className="h-1 w-px shrink-0 bg-[var(--muted)]" />
            <span className="text-[9px] leading-none text-[var(--faint)]">
              {h.confidence}
            </span>
          </span>
        ))}
      </div>

      {/* Phone only: the per-rung numbers above already label the scale on
          desktop, so this row would just repeat the endpoints. */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--faint)] sm:hidden">
        <span className="num">1 pt</span>
        <span>confidence assigned</span>
        <span className="num">{agg.ladderTop} pts</span>
      </div>
    </div>
  );
}
