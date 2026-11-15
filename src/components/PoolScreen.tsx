"use client";

import { motion } from "motion/react";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { LeagueGate, useLeagueParam } from "@/components/LeagueGate";
import { LeagueSwitcher } from "@/components/LeagueSwitcher";
import { Avatar, ErrorPanel, Loading } from "@/components/ui";
import { useIdentity, usePeople, usePool, usePoolIndex, useRecentLeagues } from "@/lib/hooks";
import type { Person } from "@/lib/name";
import type { PoolIndex } from "@/lib/pool/aggregate";
import type { PoolModel } from "@/lib/types";

export interface PoolContext {
  pool: PoolModel;
  index: PoolIndex;
  people: Map<string, Person>;
  meId: string;
  /** Clears "who am I" and shows the picker again. */
  switchMe: () => void;
}

/**
 * Every tab renders through this: league gate, data load, then the one-time
 * "which one is you?" step, then the screen itself.
 */
export function PoolScreen({ children }: { children: (ctx: PoolContext) => ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <LeagueGate>
        <Loaded render={children} />
      </LeagueGate>
    </Suspense>
  );
}

function Loaded({ render }: { render: (ctx: PoolContext) => ReactNode }) {
  const { leagueId } = useLeagueParam();
  const { data: pool, error, isLoading } = usePool(leagueId);
  const index = usePoolIndex(pool);
  const people = usePeople(pool);
  const { entryId, setEntryId } = useIdentity();
  const { remember } = useRecentLeagues();
  const groupName = pool?.meta.groupName;

  // Remember the league's name so the picker can list it under "Recent".
  useEffect(() => {
    if (leagueId && groupName) remember({ id: leagueId, name: groupName });
  }, [leagueId, groupName, remember]);

  if (isLoading || !leagueId) return <Loading label="Loading your league…" />;
  if (error) return <ErrorPanel error={error as Error} />;
  if (!pool || !index) return null;

  const meValid = entryId && pool.entries.some((e) => e.entryId === entryId);
  const switcher = (
    <LeagueSwitcher
      leagueId={leagueId}
      leagueName={pool.meta.groupName}
      me={meValid ? (people.get(entryId) ?? null) : null}
    />
  );
  if (!meValid) {
    return (
      <>
        {switcher}
        <WhoAreYou pool={pool} people={people} onPick={setEntryId} />
      </>
    );
  }
  return (
    <>
      {switcher}
      {render({ pool, index, people, meId: entryId, switchMe: () => setEntryId(null) })}
    </>
  );
}

function WhoAreYou({
  pool,
  people,
  onPick,
}: {
  pool: PoolModel;
  people: Map<string, Person>;
  onPick: (entryId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.entries
      .map((e) => people.get(e.entryId)!)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pool, people, query]);

  return (
    <div className="px-4 pt-4">
      <div className="px-1">
        <h1 className="mt-0.5 text-[32px] font-extrabold leading-tight tracking-[-0.8px]">
          Which one is you?
        </h1>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll highlight your picks everywhere. Saved on this device only.
        </p>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names"
          className="card min-h-12 w-full px-4 text-base outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
        />
      </label>
      <ul className="card mt-3 overflow-hidden py-1">
        {list.map((p, i) => (
          <motion.li
            key={p.entryId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.025, 0.4) }}
          >
            <button
              type="button"
              onClick={() => onPick(p.entryId)}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-soft"
            >
              <Avatar person={p} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-faint">@{p.username}</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mark)" strokeWidth="2.5" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
