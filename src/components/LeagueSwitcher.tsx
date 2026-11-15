"use client";

import { useCallback, useState } from "react";
import { LeaguePicker } from "@/components/LeaguePicker";
import { Sheet } from "@/components/Sheet";
import { Avatar } from "@/components/ui";
import type { Person } from "@/lib/name";

/**
 * Top-of-screen pill showing who you are and which league you're viewing.
 * Tapping it opens the league picker with the current league pinned, so an
 * accidental tap is one "Keep" away from where you were. Any choice then asks
 * who you are, which makes this the way to switch person too.
 */
export function LeagueSwitcher({
  leagueId,
  leagueName,
  me,
}: {
  leagueId: string;
  leagueName: string;
  me: Person | null;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="px-4 pt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${me ? `You are ${me.name} in` : "Viewing"} ${leagueName}. Change league or person.`}
        className="card flex min-h-11 max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left"
      >
        {me ? (
          <Avatar person={me} me size={30} />
        ) : (
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-soft text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
            </svg>
          </span>
        )}
        <span className="flex min-w-0 items-baseline gap-1.5 text-sm">
          {me ? <span className="shrink-0 font-bold">{me.name}</span> : null}
          {me ? <span className="shrink-0 text-faint">·</span> : null}
          <span className={`truncate ${me ? "text-muted" : "font-semibold"}`}>{leagueName}</span>
        </span>
        <svg className="shrink-0 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <Sheet open={open} onClose={close} label="Change league">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-3">
          <h2 className="pr-12 text-2xl font-extrabold tracking-[-0.5px]">Change league</h2>
          <p className="mt-1 text-sm text-muted">Pick a league, then pick who you are.</p>
          <div className="mt-4">
            <LeaguePicker current={{ id: leagueId, name: leagueName }} onChosen={close} />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
