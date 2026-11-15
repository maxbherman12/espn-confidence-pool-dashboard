"use client";

import { motion } from "motion/react";
import { AvatarStack, TeamLogo } from "@/components/ui";
import { kickoffLabel, modelFavorite, type GameView, type SideView } from "./gameView";

export function GameCard({
  view,
  meId,
  index,
  onOpen,
}: {
  view: GameView;
  meId: string;
  index: number;
  onOpen: () => void;
}) {
  const { away, home, locked } = view;
  const fav = modelFavorite(view);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.35 }}
      whileTap={{ scale: 0.98 }}
      aria-label={`${away.short} at ${home.short}. Show everyone's picks`}
      className="card w-full px-3 pb-3 pt-3.5 text-left"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        <Team side={away} decided={view.decided} />
        <Middle view={view} />
        <Team side={home} decided={view.decided} />
      </div>

      {locked ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <Crowd side={away} meId={meId} />
          <Crowd side={home} meId={meId} />
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-muted">
          <LockIcon />
          {fav ? `ESPN model: ${fav.team} ${fav.pct}% · ` : ""}Picks revealed at kickoff
        </div>
      )}
    </motion.button>
  );
}

function Team({ side, decided }: { side: SideView; decided: boolean }) {
  const dim = decided && !side.won;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <TeamLogo src={side.outcome.logo} abbrev={side.outcome.abbrev} size={42} ring={side.ring} />
      <span className={`max-w-full truncate text-[13px] font-bold ${dim ? "text-faint" : ""}`}>
        {side.short}
      </span>
    </div>
  );
}

function Middle({ view }: { view: GameView }) {
  const { game, away, home } = view;
  if (game.status === "PENDING") {
    return (
      <div className="px-1 text-center">
        <div className="whitespace-nowrap text-lg font-extrabold">{kickoffLabel(game.kickoff)}</div>
        <div className="text-xs font-semibold text-faint">
          {[away.outcome.record, home.outcome.record].filter(Boolean).join(" · ")}
        </div>
      </div>
    );
  }
  const live = game.status === "IN_PROGRESS";
  return (
    <div className="px-1 text-center">
      <div className="whitespace-nowrap text-[26px] font-extrabold tracking-[-1px]">
        <span className={view.decided && !away.won ? "text-faint" : ""}>{away.outcome.score ?? 0}</span>
        <span className="px-1.5 text-mark">–</span>
        <span className={view.decided && !home.won ? "text-faint" : ""}>{home.outcome.score ?? 0}</span>
      </div>
      <div className={`flex items-center justify-center gap-1 text-xs font-semibold ${live ? "text-loss" : "text-muted"}`}>
        {live ? <span className="size-1.5 animate-pulse rounded-full bg-loss" /> : null}
        {live ? (game.statusDetail ?? "Live") : "Final"}
      </div>
    </div>
  );
}

function Crowd({ side, meId }: { side: SideView; meId: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <AvatarStack people={side.pickers.map((p) => p.person)} meId={meId} />
      <span className="text-xs font-semibold text-muted">
        {side.pickers.length} picked {side.outcome.abbrev}
      </span>
    </div>
  );
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
