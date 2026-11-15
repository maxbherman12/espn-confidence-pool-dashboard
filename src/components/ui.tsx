"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import type { Person } from "@/lib/name";
import type { PoolWeek } from "@/lib/types";

/* ------------------------------------------------------------------ *
 * People and teams
 * ------------------------------------------------------------------ */

export function Avatar({
  person,
  me = false,
  size = 32,
  ring,
  className = "",
  style,
}: {
  person: Pick<Person, "initials" | "color" | "name"> | null;
  me?: boolean;
  size?: number;
  /** Border colour, to separate overlapping avatars from what's behind them. */
  ring?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.37),
        background: me ? "var(--accent)" : (person?.color ?? "#8e8e96"),
        border: ring ? `2px solid ${ring}` : undefined,
        ...style,
      }}
    >
      {person?.initials ?? "?"}
    </span>
  );
}

/** Overlapping avatars with a "+n" chip after `max`. */
export function AvatarStack({
  people,
  meId,
  max = 5,
  size = 26,
  ring = "var(--card)",
}: {
  people: (Person | undefined)[];
  meId: string | null;
  max?: number;
  size?: number;
  ring?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex">
      {shown.map((p, i) => (
        <Avatar
          key={p?.entryId ?? i}
          person={p ?? null}
          me={p?.entryId === meId}
          size={size}
          ring={ring}
          style={{ marginLeft: i ? -8 : 0 }}
        />
      ))}
      {extra > 0 ? (
        <span
          className="flex shrink-0 items-center justify-center rounded-full bg-[#8e8e96] font-bold text-white"
          style={{
            width: size,
            height: size,
            fontSize: Math.round(size * 0.37),
            border: `2px solid ${ring}`,
            marginLeft: shown.length ? -8 : 0,
          }}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

export type RingTone = "pending" | "win" | "loss" | null;

const RING: Record<Exclude<RingTone, null>, { ring: string; fill: string }> = {
  pending: { ring: "var(--accent)", fill: "var(--accent-soft)" },
  win: { ring: "var(--win)", fill: "var(--win-soft)" },
  loss: { ring: "var(--loss)", fill: "var(--loss-soft)" },
};

/**
 * Team logo, optionally ringed to mark "your pick": blue until the game is
 * decided, then green if you were right and red if you weren't.
 */
export function TeamLogo({
  src,
  abbrev,
  size = 42,
  ring = null,
  label,
}: {
  src: string | null;
  abbrev: string;
  size?: number;
  ring?: RingTone;
  label?: string;
}) {
  const box = Math.round(size * 1.28);
  const tone = ring ? RING[ring] : null;
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full transition-[box-shadow,background-color] duration-300"
      style={{
        width: box,
        height: box,
        boxShadow: tone ? `0 0 0 3px ${tone.ring}` : undefined,
        background: tone ? tone.fill : undefined,
      }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {src ? (
        // ESPN CDN logos via a plain <img>: keeps them off the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />
      ) : (
        <span className="text-sm font-extrabold text-muted">{abbrev}</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: ReactNode;
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-2 pt-3">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-muted">{eyebrow}</div>
        <h1 className="mt-0.5 text-[32px] font-extrabold leading-tight tracking-[-0.8px]">
          {title}
        </h1>
      </div>
      {right}
    </header>
  );
}

/** Week picker: a pill that opens the native picker, which is best on phones. */
export function WeekPicker({
  weeks,
  value,
  onChange,
}: {
  weeks: PoolWeek[];
  value: number;
  onChange: (week: number) => void;
}) {
  const options = weeks.filter((w) => w.status !== "FUTURE" && w.gameCount > 0);
  return (
    <label className="card relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">
      <span className="sr-only">Week</span>
      Wk {value}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
        active ? "bg-ink text-bg" : "bg-card text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

/** Counts up to `value` on mount and glides between values after. */
export function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const shown = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{shown}</motion.span>;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/* ------------------------------------------------------------------ *
 * States
 * ------------------------------------------------------------------ */

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-3 px-4 pt-6" aria-busy="true">
      <p className="px-1 text-sm text-muted">{label}</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-28 animate-pulse" />
      ))}
    </div>
  );
}

export function ErrorPanel({ error }: { error: Error }) {
  return (
    <div className="card m-4 p-5">
      <h2 className="text-base font-bold text-loss">Couldn&apos;t load this league</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{error.message}</p>
      <p className="mt-3 text-sm text-faint">
        Check the link you used, or search for your group by name.{" "}
        <Link className="font-semibold text-accent" href="/?new=1">
          Find your league
        </Link>
      </p>
    </div>
  );
}
