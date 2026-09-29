"use client";

import { useState } from "react";
import { readableColor, TeamBadge } from "@/components/ui";
import type { GameAgg, OutcomeAgg } from "@/lib/types";

/**
 * A single bar per game, split by how the group voted: the left segment is one
 * team's share of the members who picked, the right segment is the other's, so
 * a 50/50 pool reads as a bar cut exactly in half.
 *
 * Only the pick split is drawn. Everything else - who backed each side, how
 * much confidence they put on it, and where the group sits against the national
 * pool - is in the panel that opens for the side you point at or tap. A floating
 * tooltip would be the wrong shape here: it clips against the card edge and
 * cannot be reached by touch, so the detail goes in flow directly underneath.
 */
export function SplitBar({
  agg,
  highlightEntryId,
}: {
  agg: GameAgg;
  highlightEntryId: string | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  // Hover previews on pointer devices; a tap pins the panel open on touch.
  const shown = pinned ?? active;
  const sides = agg.byOutcome;
  if (sides.length === 0) return null;

  return (
    <div>
      <div
        className="flex h-11 w-full gap-0.5 overflow-hidden rounded-md"
        role="group"
        aria-label={`Pick split: ${sides
          .map((s) => `${s.outcome.abbrev} ${Math.round(s.share * 100)} percent`)
          .join(", ")}. Activate a side to see who picked it.`}
      >
        {sides.map((side, i) => {
          const pctShare = side.share * 100;
          const isOpen = shown === i;
          return (
            <button
              key={side.outcome.outcomeId}
              type="button"
              aria-expanded={isOpen}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setPinned((p) => (p === i ? null : i))}
              className={`relative flex min-w-0 items-center justify-center overflow-hidden px-1 transition-[filter,opacity] ${
                shown !== null && !isOpen ? "opacity-55" : ""
              }`}
              style={{
                width: `${pctShare}%`,
                background: readableColor(
                  side.outcome.color,
                  i === 0 ? "var(--away-fallback)" : "var(--home-fallback)",
                ),
              }}
            >
              {/* Team code rides inside the segment once it is wide enough. */}
              <span
                className={`num truncate text-[11px] font-bold text-[#080b12] ${
                  pctShare >= 30 ? "inline" : "hidden"
                }`}
              >
                {pctShare >= 30 ? `${side.outcome.abbrev} ${Math.round(pctShare)}%` : side.outcome.abbrev}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px]">
        {sides.map((side, i) => (
          <button
            key={side.outcome.outcomeId}
            type="button"
            onClick={() => setPinned((p) => (p === i ? null : i))}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex min-w-0 items-center gap-1.5 rounded text-left ${
              shown === i ? "text-[var(--text)]" : "text-[var(--muted)]"
            }`}
          >
            <TeamBadge
              abbrev={side.outcome.abbrev}
              logo={side.outcome.logo}
              color={side.outcome.color}
              size={16}
            />
            <span className="num shrink-0 font-semibold">
              {Math.round(side.share * 100)}%
            </span>
            <span className="num truncate text-[var(--faint)]">
              {side.picks}/{agg.respondents}
            </span>
          </button>
        ))}
      </div>

      {shown !== null ? (
        <SideDetail
          side={sides[shown]}
          agg={agg}
          highlightEntryId={highlightEntryId}
        />
      ) : null}
    </div>
  );
}

function SideDetail({
  side,
  agg,
  highlightEntryId,
}: {
  side: OutcomeAgg;
  agg: GameAgg;
  highlightEntryId: string | null;
}) {
  const decided = agg.game.correctOutcomeIds[0] === side.outcome.outcomeId;
  const stake = agg.pointsAtStake[side.outcome.outcomeId];
  const edge =
    side.nationalShare === null
      ? null
      : side.share * 100 - side.nationalShare;

  return (
    <div className="mt-2.5 rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
          <TeamBadge
            abbrev={side.outcome.abbrev}
            logo={side.outcome.logo}
            color={side.outcome.color}
            size={16}
          />
          {side.outcome.abbrev}
        </span>
        <span className="num text-[var(--muted)]">
          {side.picks} of {agg.respondents} picked
        </span>
        <span className="num text-[var(--muted)]">
          {side.medianConfidence !== null
            ? `median ${side.medianConfidence} pt`
            : "no picks"}
        </span>
        {side.nationalShare !== null ? (
          <span
            className={`num ${
              edge === null
                ? "text-[var(--faint)]"
                : edge > 0
                  ? "text-[var(--positive)]"
                  : edge < 0
                    ? "text-[var(--negative)]"
                    : "text-[var(--faint)]"
            }`}
          >
            {edge !== null && edge > 0 ? "+" : ""}
            {edge?.toFixed(0)} vs {side.nationalShare.toFixed(0)}% national
          </span>
        ) : null}
        {decided ? (
          <span className="text-[var(--positive)]">correct so far</span>
        ) : agg.undecided ? null : (
          <span className="text-[var(--faint)]">not the winner</span>
        )}
      </div>

      {side.pickers.length > 0 ? (
        <>
          <ul className="mt-2 flex max-h-44 flex-wrap gap-1 overflow-y-auto">
            {side.pickers.map((p) => (
              <li
                key={p.entryId}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                  p.entryId === highlightEntryId
                    ? "border-[var(--accent)] font-semibold text-[var(--text)]"
                    : "border-[var(--line)] text-[var(--text-dim)]"
                }`}
              >
                <span className="max-w-[9rem] truncate">{p.displayName}</span>
                <span className="num rounded bg-[var(--surface-3)] px-1 text-[10px] text-[var(--text)]">
                  {p.confidence}
                </span>
              </li>
            ))}
          </ul>
          <p className="num mt-1.5 text-[11px] text-[var(--faint)]">
            {side.pickers.length} member{side.pickers.length === 1 ? "" : "s"} ·{" "}
            {side.confidencePoints} of {agg.totalConfidencePoints} confidence points (
            {side.confidenceShare.toFixed(0)}%)
            {stake === null
              ? " · points at stake settle when the game ends"
              : ` · ${stake} pts at stake`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--faint)]">
          Nobody in the group picked this side.
        </p>
      )}
    </div>
  );
}
