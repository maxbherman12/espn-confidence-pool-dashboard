"use client";

import { Control } from "@/components/ui";
import type { PoolWeek } from "@/lib/types";

export function WeekSelector({
  weeks,
  value,
  onChange,
  label = "Week",
}: {
  weeks: PoolWeek[];
  value: number;
  onChange: (week: number) => void;
  label?: string;
}) {
  const selected = weeks.find((w) => w.id === value);
  return (
    // `min-w-0` matters: a select sizes to its widest option, and without it
    // the long "Week 12 · Nov 26 - Dec 3 · 14 games · upcoming" labels would
    // push the whole page wider than the viewport.
    <div className="flex min-w-0 items-center gap-2">
      <label
        htmlFor="week-select"
        className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]"
      >
        {label}
      </label>
      <Control
        id="week-select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 sm:w-[260px] sm:flex-none"
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
            {w.subLabel ? ` · ${w.subLabel}` : ""}
            {w.gameCount ? ` · ${w.gameCount} games` : ""}
            {w.status === "IN_PROGRESS" ? " · live" : ""}
            {w.status === "FUTURE" ? " · upcoming" : ""}
          </option>
        ))}
      </Control>
      {selected?.status === "IN_PROGRESS" ? (
        <span className="num shrink-0 text-[11px] text-[var(--warn)]">in progress</span>
      ) : null}
    </div>
  );
}
