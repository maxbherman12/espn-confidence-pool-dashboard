"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { Avatar, TeamLogo } from "@/components/ui";
import { LockIcon } from "./GameCard";
import { kickoffLabel, modelFavorite, type GameView, type SideView } from "./gameView";

/**
 * Full picks for one game, in a panel that slides up over most of the screen.
 * Dismiss by tapping outside, the close button, Escape, or dragging it down.
 */
export function GameSheet({
  view,
  meId,
  onClose,
}: {
  view: GameView | null;
  meId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!view) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [view, onClose]);

  return (
    <AnimatePresence>
      {view ? (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={`${view.away.short} at ${view.home.short}`}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col overflow-x-hidden rounded-t-[28px] bg-card shadow-[0_-8px_30px_rgb(0_0_0/0.15)]"
            style={{ top: "max(48px, env(safe-area-inset-top))" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <SheetBody view={view} meId={meId} onClose={onClose} />
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function SheetBody({ view, meId, onClose }: { view: GameView; meId: string; onClose: () => void }) {
  const { game, away, home, locked, decided } = view;
  const total = away.points + home.points || 1;
  const fav = modelFavorite(view);
  const live = game.status === "IN_PROGRESS";

  return (
    <>
      <div className="flex justify-center pt-2">
        <span className="h-[5px] w-10 rounded-full bg-mark" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-soft"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-5 pt-[18px]">
        <BigTeam side={away} decided={decided} />
        <div className="px-1 text-center">
          {game.status === "PENDING" ? (
            <div className="whitespace-nowrap text-xl font-extrabold">{kickoffLabel(game.kickoff)}</div>
          ) : (
            <div className="whitespace-nowrap text-[34px] font-extrabold tracking-[-1px]">
              <span className={decided && !away.won ? "text-faint" : ""}>{away.outcome.score ?? 0}</span>
              <span className="px-1.5 text-mark">–</span>
              <span className={decided && !home.won ? "text-faint" : ""}>{home.outcome.score ?? 0}</span>
            </div>
          )}
          <div className={`text-[13px] font-semibold ${live ? "text-loss" : "text-muted"}`}>
            {game.status === "COMPLETE" ? "Final" : live ? (game.statusDetail ?? "Live") : "Upcoming"}
          </div>
        </div>
        <BigTeam side={home} decided={decided} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {locked ? (
          <>
            <div className="mx-5 mt-[18px]">
              <div className="flex justify-between gap-2 text-[13px] font-bold">
                <span className="whitespace-nowrap">{away.points} pts</span>
                <span className="min-w-0 text-center font-semibold text-muted">Points riding</span>
                <span className="whitespace-nowrap">{home.points} pts</span>
              </div>
              <div className="mt-1.5 flex h-2.5 gap-[3px]">
                <motion.div
                  className="min-w-1.5 origin-left rounded-full"
                  style={{ width: `${(away.points / total) * 100}%`, background: away.won ? "var(--win)" : decided ? "var(--mark)" : "var(--accent)" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                />
                <motion.div
                  className="min-w-1.5 origin-right rounded-full"
                  style={{ width: `${(home.points / total) * 100}%`, background: home.won ? "var(--win)" : decided ? "var(--mark)" : "var(--accent-track)" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
            </div>
            <div className="mx-5 mt-2 flex justify-between gap-2 text-[13px] text-muted">
              <span className="whitespace-nowrap">med {median(away)}</span>
              <span className="min-w-0 text-center">Median pick</span>
              <span className="whitespace-nowrap">med {median(home)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 px-3.5 pb-4 pt-4">
              <PickerColumn side={away} meId={meId} decided={decided} />
              <PickerColumn side={home} meId={meId} decided={decided} />
            </div>
          </>
        ) : (
          <div className="mx-5 mt-5 flex items-center gap-2 rounded-2xl bg-soft px-4 py-3 text-sm text-muted">
            <LockIcon />
            Everyone&apos;s picks, yours included, show up at kickoff.
          </div>
        )}

        <Odds view={view} fav={fav} />
      </div>

      {view.missed.length ? (
        <div className="border-t border-line px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 text-[13px] text-muted">
          No pick: {view.missed.map((p) => p?.name ?? "Unknown").join(", ")}
        </div>
      ) : (
        <div className="pb-[env(safe-area-inset-bottom)]" />
      )}
    </>
  );
}

/**
 * The median pick on one side: one person dumping 15 points on
 * an underdog shouldn't drag the typical pick around the way a mean would.
 * Shown as "9" or "9.5", or "–" when nobody picked the side.
 */
function median(side: SideView): string {
  const values = side.pickers.map((p) => p.confidence).sort((a, b) => a - b);
  if (!values.length) return "–";
  const mid = values.length >> 1;
  const value = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function BigTeam({ side, decided }: { side: SideView; decided: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <TeamLogo src={side.outcome.logo} abbrev={side.outcome.abbrev} size={56} ring={side.ring} />
      <span className={`max-w-full truncate text-[15px] font-bold ${decided && !side.won ? "text-faint" : ""}`}>
        {side.short}
      </span>
    </div>
  );
}

function PickerColumn({ side, meId, decided }: { side: SideView; meId: string; decided: boolean }) {
  return (
    <div className="min-w-0">
      <div className="px-1.5 pb-1.5 text-[13px] font-bold text-muted">
        {side.pickers.length} picked {side.outcome.abbrev}
      </div>
      <ul className="flex flex-col gap-0.5">
        {side.pickers.map((p, i) => {
          const me = p.entryId === meId;
          return (
            <motion.li
              key={p.entryId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + Math.min(i, 14) * 0.025 }}
              className={`flex min-w-0 items-center gap-1.5 rounded-xl px-1.5 py-1.5 text-sm ${
                me ? "bg-accent-soft font-bold ring-[1.5px] ring-inset ring-accent" : "font-medium"
              }`}
            >
              <Avatar person={p.person ?? null} me={me} size={26} />
              <span className="min-w-0 flex-1 truncate">{me ? "You" : (p.person?.name ?? "Unknown")}</span>
              <span
                className={`min-w-8 shrink-0 rounded-lg py-0.5 text-center text-[13px] font-bold ${
                  !decided
                    ? "bg-soft text-ink"
                    : side.won
                      ? "bg-win-soft text-win"
                      : "bg-soft text-faint line-through"
                }`}
              >
                {decided && side.won ? "+" : ""}
                {p.confidence}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function Odds({ view, fav }: { view: GameView; fav: { team: string; pct: number } | null }) {
  const { away, home, game } = view;
  const lines: string[] = [];
  if (fav) lines.push(`ESPN model: ${fav.team} ${fav.pct}% to win`);
  const nat = [away, home]
    .filter((s) => s.outcome.national)
    .sort((a, b) => (b.outcome.national!.pct ?? 0) - (a.outcome.national!.pct ?? 0))[0];
  if (nat) lines.push(`${Math.round(nat.outcome.national!.pct)}% of everyone on ESPN picked ${nat.short}`);
  if (game.spread !== null) {
    const favSide = game.spread < 0 ? home : away;
    lines.push(`Vegas: ${favSide.short} by ${Math.abs(game.spread)}`);
  }
  if (!lines.length) return null;
  return (
    <ul className="mx-5 mb-4 mt-1 space-y-1 rounded-2xl bg-soft px-4 py-3 text-[13px] text-muted">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}
