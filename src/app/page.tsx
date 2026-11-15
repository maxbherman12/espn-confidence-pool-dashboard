"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { PoolScreen, type PoolContext } from "@/components/PoolScreen";
import { AnimatedNumber, Avatar, PageHeader, WeekPicker, ordinal } from "@/components/ui";
import type { Person } from "@/lib/name";
import { openGames, standings, type StandingRow } from "@/lib/pool/standings";

export default function StandingsPage() {
  return <PoolScreen>{(ctx) => <Standings {...ctx} />}</PoolScreen>;
}

function Standings({ pool, index, people, meId, switchMe }: PoolContext) {
  const [week, setWeek] = useState(pool.meta.currentWeek);
  const [mode, setMode] = useState<"season" | "week">("season");
  const rows = useMemo(() => standings(pool, index, week, mode), [pool, index, week, mode]);
  // The card follows the selected tab: season place or this week's place.
  const me = rows.find((r) => r.entryId === meId)!;
  const open = openGames(index, week);

  return (
    <>
      <PageHeader
        eyebrow={`Week ${week}`}
        title="Standings"
        right={<WeekPicker weeks={pool.meta.weeks} value={week} onChange={setWeek} />}
      />

      <YouCard
        me={me}
        person={people.get(meId)!}
        mode={mode}
        open={open}
        onSwitch={switchMe}
      />

      <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-1">
        <div role="tablist" aria-label="Standings view" className="flex rounded-full bg-card p-1 shadow-[var(--shadow)]">
          {(["season", "week"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                mode === m ? "bg-ink text-bg" : "text-muted"
              }`}
            >
              {m === "season" ? "Season" : "This week"}
            </button>
          ))}
        </div>
        {mode === "week" ? <Legend /> : null}
      </div>

      <motion.ol layout className="card mx-4 overflow-hidden py-1">
        {rows.map((r, i) => (
          <Row
            key={r.entryId}
            row={r}
            index={i}
            person={people.get(r.entryId)!}
            me={r.entryId === meId}
            mode={mode}
          />
        ))}
      </motion.ol>
    </>
  );
}

function YouCard({
  me,
  person,
  mode,
  open,
  onSwitch,
}: {
  me: StandingRow;
  person: Person;
  mode: "season" | "week";
  open: number;
  onSwitch: () => void;
}) {
  const lost = me.ladder - me.weekMax;
  const r = 46;
  const c = 2 * Math.PI * r;
  const seg = (v: number) => (me.ladder ? (v / me.ladder) * c : 0);
  const won = seg(me.weekScore);
  const possible = seg(me.weekMax - me.weekScore);
  const gone = seg(lost);
  const done = open === 0;

  const scope = mode === "season" ? "for the season" : "this week";
  const standing = me.back === 0 ? `In 1st ${scope}` : `${me.back} behind 1st ${scope}`;

  return (
    <section aria-label="You" className="card mx-4 my-2 flex items-center gap-4 p-[18px]">
      <div className="relative size-28 shrink-0">
        <svg
          width="112"
          height="112"
          viewBox="0 0 112 112"
          role="img"
          aria-label={`This week: ${me.weekScore} scored, ${me.weekMax - me.weekScore} still possible, ${lost} lost, out of ${me.ladder}`}
          className="-rotate-90"
        >
          <circle cx="56" cy="56" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
          {[
            { len: won, off: 0, color: "var(--win)" },
            { len: possible, off: won, color: "var(--accent-track)" },
            { len: gone, off: won + possible, color: "var(--loss)" },
          ].map((s, i) => (
            <motion.circle
              key={i}
              cx="56"
              cy="56"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDashoffset={-s.off}
              initial={{ strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: `${s.len} ${c}` }}
              transition={{ duration: 1.1, delay: 0.1 + i * 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[30px] font-extrabold leading-none tracking-[-1px] text-accent">
            <AnimatedNumber value={done ? me.weekScore : me.weekMax} />
          </div>
          <div className="mt-1 text-[11px] font-semibold text-muted">
            {done ? "scored" : "week max"}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <button type="button" onClick={onSwitch} className="flex min-w-0 items-center gap-2 text-left" aria-label={`You are ${person.name}. Tap to switch.`}>
          <Avatar person={person} me size={28} />
          <span className="truncate text-[15px] font-bold">{person.name}</span>
        </button>
        <div className="text-[28px] font-extrabold leading-tight tracking-[-0.6px]">
          {ordinal(me.rank)}{" "}
          <span className="text-[15px] font-semibold text-muted">
            · <AnimatedNumber value={me.value} /> pts
          </span>
        </div>
        <div className="text-[13px] leading-snug text-muted">{standing}</div>
      </div>
    </section>
  );
}

function Legend() {
  const items = [
    ["var(--win)", "Scored"],
    ["var(--accent-track)", "Possible"],
    ["var(--loss)", "Lost"],
  ];
  return (
    <div className="flex gap-2.5 text-[11px] text-muted">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1">
          <i className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function Row({
  row,
  index,
  person,
  me,
  mode,
}: {
  row: StandingRow;
  index: number;
  person: Person;
  me: boolean;
  mode: "season" | "week";
}) {
  const pct = (v: number) => (row.ladder ? `${(v / row.ladder) * 100}%` : "0%");
  const lost = row.ladder - row.weekMax;
  const delay = 0.1 + Math.min(index, 12) * 0.035;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, layout: { type: "spring", stiffness: 380, damping: 32 } }}
      className={`flex min-h-[60px] items-center gap-3 px-3.5 ${index ? "border-t border-line" : ""} ${
        me ? "bg-accent-soft" : ""
      }`}
    >
      <span className="w-6 text-center text-[15px] font-bold text-muted">{row.rank}</span>
      <Avatar person={person} me={me} size={34} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{person.name}</span>
          <span className="block truncate text-xs text-faint">@{person.username}</span>
        </span>
        {mode === "week" ? (
        <span
          className="flex h-1 overflow-hidden rounded-full bg-line"
          role="img"
          aria-label={`This week: ${row.weekScore} scored, max ${row.weekMax}`}
        >
          {[
            [row.weekScore, "var(--win)"],
            [row.weekMax - row.weekScore, "var(--accent-track)"],
            [lost, "var(--loss)"],
          ].map(([v, color], i) => (
            <motion.span
              key={i}
              className="h-full origin-left"
              style={{ width: pct(v as number), background: color as string }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: delay + 0.1, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ))}
        </span>
        ) : null}
      </span>
      <span className="text-right">
        <span className="block text-[17px] font-bold tracking-[-0.3px]">{row.value}</span>
        {mode === "week" ? (
          <span className="block whitespace-nowrap text-xs text-faint">max {row.weekMax}</span>
        ) : null}
      </span>
    </motion.li>
  );
}
