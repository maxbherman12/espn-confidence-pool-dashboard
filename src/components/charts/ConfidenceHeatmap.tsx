"use client";

import { useMemo, useState } from "react";
import type { PoolIndex } from "@/lib/pool/aggregate";
import type { PoolEntry, PoolGame } from "@/lib/types";
import { readableColor } from "@/components/ui";

const ROW_H = 24;
const CELL_W = 30;
const LABEL_W = 120;
const SCORE_W = 62;
const HEAD_H = 28;

interface Hover {
  entry: PoolEntry;
  game: PoolGame;
  confidence: number | null;
}

/**
 * Entries x games confidence heatmap for a single week.
 *
 * Each cell encodes which team a member backed (hue) and how much confidence
 * they put on it (brightness), so a member who dumped 16 points on a coin flip
 * is obvious at a glance. A dashed cell means the member never picked that game.
 */
export function ConfidenceHeatmap({
  games,
  entries,
  index,
  week,
  highlightEntryId,
  onSelect,
}: {
  games: PoolGame[];
  entries: PoolEntry[];
  index: PoolIndex;
  week: number;
  highlightEntryId: string | null;
  onSelect?: (entryId: string) => void;
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  const weekScores = useMemo(() => {
    const m = new Map<string, { score: number; max: number }>();
    for (const e of entries) {
      const w = e.espn.byWeek[String(week)];
      m.set(e.entryId, { score: w?.score ?? 0, max: w?.possiblePointsMax ?? 0 });
    }
    return m;
  }, [entries, week]);

  const ladder = useMemo(
    () => Math.max(1, ...entries.flatMap((e) => e.picks.map((p) => p.confidence))),
    [entries],
  );

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => (weekScores.get(b.entryId)?.score ?? 0) - (weekScores.get(a.entryId)?.score ?? 0),
      ),
    [entries, weekScores],
  );

  if (games.length === 0) return null;

  const width = LABEL_W + games.length * CELL_W + SCORE_W;
  const height = HEAD_H + sorted.length * ROW_H + 4;

  return (
    <div>
      <div className="scroller -mx-1 px-1">
        <svg
          width={width}
          height={height}
          className="min-w-full"
          role="img"
          aria-label="Confidence heatmap of every member's picks for the week. Scroll sideways to see every game."
        >
          {games.map((g, i) => {
            const cx = LABEL_W + i * CELL_W + CELL_W / 2;
            const [away, home] = splitTeams(g);
            return (
              <g key={g.propId}>
                <text x={cx} y={11} fill="#a6b1ca" fontSize={9.5} textAnchor="middle">
                  {away}
                </text>
                <text x={cx} y={21} fill="#7e8aa6" fontSize={9.5} textAnchor="middle">
                  @{home}
                </text>
              </g>
            );
          })}
          <text
            x={width - SCORE_W / 2}
            y={16}
            fill="#a6b1ca"
            fontSize={9.5}
            textAnchor="middle"
          >
            score
          </text>

          {sorted.map((entry, r) => {
            const y = HEAD_H + r * ROW_H;
            const picks = index.picksByEntry.get(entry.entryId);
            const { score, max } = weekScores.get(entry.entryId) ?? {
              score: 0,
              max: 0,
            };
            const isMe = highlightEntryId === entry.entryId;
            return (
              <g
                key={entry.entryId}
                onClick={() => onSelect?.(entry.entryId)}
                className={onSelect ? "cursor-pointer" : undefined}
              >
                <rect
                  x={0}
                  y={y}
                  width={width}
                  height={ROW_H}
                  fill={isMe ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "transparent"}
                />
                <text
                  x={8}
                  y={y + 15}
                  fill={isMe ? "#f0f3f9" : "#c3cbe0"}
                  fontSize={11}
                  fontWeight={isMe ? 600 : 400}
                >
                  {truncate(entry.displayName, 15)}
                </text>
                {games.map((g, i) => {
                  const pick = picks?.get(g.propId);
                  const x = LABEL_W + i * CELL_W;
                  if (!pick) {
                    return (
                      <rect
                        key={g.propId}
                        x={x + 1}
                        y={y + 3}
                        width={CELL_W - 2}
                        height={ROW_H - 6}
                        fill="none"
                        stroke="#37425e"
                        strokeDasharray="2 2"
                        rx={2}
                      />
                    );
                  }
                  const outcome = g.outcomes.find((o) => o.outcomeId === pick.outcomeId);
                  const base = readableColor(outcome?.color ?? null, "var(--away-fallback)");
                  const t = Math.min(1, pick.confidence / ladder);
                  const isWinner = g.correctOutcomeIds.includes(pick.outcomeId);
                  return (
                    <rect
                      key={g.propId}
                      x={x + 1}
                      y={y + 3}
                      width={CELL_W - 2}
                      height={ROW_H - 6}
                      rx={2}
                      fill={base}
                      opacity={0.22 + t * 0.78}
                      stroke={isWinner ? "rgba(240,243,249,0.6)" : "transparent"}
                      strokeWidth={1}
                      onMouseEnter={() =>
                        setHover({ entry, game: g, confidence: pick.confidence })
                      }
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
                <text
                  x={width - SCORE_W / 2}
                  y={y + 15}
                  fill="#f0f3f9"
                  fontSize={11}
                  textAnchor="middle"
                  fontWeight={600}
                >
                  {score}
                  <tspan fill="#7e8aa6" fontWeight={400}>
                    {max ? `/${max}` : ""}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-1.5 flex min-h-[18px] flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--faint)]">
        <span>
          Brightness = confidence points. Dashed = no pick. Outline = correct.
          Scroll for more games.
        </span>
        {hover ? (
          <span className="text-[var(--text-dim)]">
            {hover.entry.displayName} · {hover.game.name} ·{" "}
            {hover.confidence === null ? (
              <span className="text-[var(--negative)]">no pick</span>
            ) : (
              <>
                {hover.game.outcomes.find((o) => o.outcomeId === pickOutcome(hover, index))
                  ?.abbrev ?? "?"}{" "}
                for {hover.confidence} pt
              </>
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function pickOutcome(hover: Hover, index: PoolIndex): string | null {
  return (
    index.picksByEntry.get(hover.entry.entryId)?.get(hover.game.propId)?.outcomeId ??
    null
  );
}

function splitTeams(g: PoolGame): [string, string] {
  const parts = g.name.split(" @ ");
  return [parts[0] ?? "?", parts[1] ?? "?"];
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
