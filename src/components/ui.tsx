"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { PoolGame } from "@/lib/types";

/* ------------------------------------------------------------------ *
 * Team identity
 * ------------------------------------------------------------------ */

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex([h, s, l]: [number, number, number]): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    const to = (x: number) => x.toString(16).padStart(2, "0");
    return `#${to(v)}${to(v)}${to(v)}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const to = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(channel(h + 1 / 3))}${to(channel(h))}${to(channel(h - 1 / 3))}`;
}

/**
 * ESPN team colours run from near-black to neon, which makes many of them
 * unusable on a dark surface. Normalise in HSL rather than blending toward
 * white: raising lightness preserves the hue and saturation that tell
 * next-door teams apart (Vikings purple against Lions blue), whereas blending
 * to white would wash both into the same pastel.
 */
export function readableColor(hex: string | null, fallback: string): string {
  const rgb = parseHex(hex ?? "");
  if (!rgb) return fallback;
  const [h, s, l] = rgbToHsl(rgb);
  const lightness = Math.min(0.74, Math.max(l, 0.55));
  const saturation = Math.min(1, Math.max(s, 0.55));
  return hslToHex([h, saturation, lightness]);
}

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

/** Shared control chrome. 44px minimum height keeps taps usable. */
const CONTROL =
  "min-h-11 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]";

export function Control({ className = "", ...rest }: React.ComponentProps<"select">) {
  return <select {...rest} className={`${CONTROL} ${className}`} />;
}

export function Btn({
  variant = "ghost",
  className = "",
  ...rest
}: React.ComponentProps<"button"> & { variant?: "ghost" | "primary" | "quiet" }) {
  const tone =
    variant === "primary"
      ? "border-[transparent] bg-[var(--accent)] font-semibold text-[#06121f] hover:bg-[var(--accent-strong)]"
      : variant === "quiet"
        ? "border-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]";
  return (
    <button
      {...rest}
      className={`min-h-11 shrink-0 rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${className}`}
    />
  );
}

export function SectionHead({
  title,
  hint,
}: {
  title: string;
  hint?: ReactNode;
}) {
  return (
    <h2 className="text-sm font-semibold tracking-tight">
      {title}
      {hint ? (
        <span className="ml-0 mt-0.5 block text-[11px] font-normal text-[var(--faint)] sm:mt-0 sm:inline">
          {hint}
        </span>
      ) : null}
    </h2>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warn";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--positive)]"
      : tone === "negative"
        ? "text-[var(--negative)]"
        : tone === "warn"
          ? "text-[var(--warn)]"
          : "text-[var(--text)]";
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
        {label}
      </div>
      <div className={`num mt-0.5 text-xl font-semibold ${toneClass}`}>{value}</div>
      {sub ? (
        <div className="mt-0.5 truncate text-xs text-[var(--muted)]">{sub}</div>
      ) : null}
    </div>
  );
}

export function StatusPill({ game }: { game: PoolGame }) {
  if (game.status === "COMPLETE") {
    return (
      <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-dim)]">
        Final
      </span>
    );
  }
  if (game.status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--negative)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--negative)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--negative)]" />
        {game.statusDetail ?? "Live"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-dim)]">
      Upcoming
    </span>
  );
}

export function TeamBadge({
  abbrev,
  logo,
  color,
  size = 20,
}: {
  abbrev: string;
  logo: string | null;
  color: string | null;
  size?: number;
}) {
  const tint = readableColor(color, "var(--away-fallback)");
  if (logo) {
    return (
      // Team logos come from ESPN's CDN as small PNGs. A plain <img> keeps them
      // off Vercel's image optimizer, which matters on the free tier.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-sm object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-sm font-semibold text-[#080b12]"
      style={{
        width: size,
        height: size,
        background: tint,
        fontSize: Math.max(8, Math.round(size * 0.42)),
      }}
    >
      {abbrev.slice(0, 2)}
    </span>
  );
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function ErrorPanel({ error }: { error: Error }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-[var(--negative)]">
        Could not load this league
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-dim)]">
        {error.message}
      </p>
      <p className="mt-3 text-xs text-[var(--faint)]">
        The league id is the last segment of your group&apos;s URL on espn.com, and
        the league has to be public.{" "}
        <Link
          className="text-[var(--accent)] underline-offset-2 hover:underline"
          href="/?new=1"
        >
          Use a different league
        </Link>
        .
      </p>
    </Card>
  );
}
