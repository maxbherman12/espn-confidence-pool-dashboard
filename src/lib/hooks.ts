"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useLocalValue } from "@/lib/local";
import { buildPeople, type Person } from "@/lib/name";
import { indexPool, type PoolIndex } from "@/lib/pool/aggregate";
import type { PoolModel } from "@/lib/types";

export const POOL_KEY = "pool" as const;
/** Stores the chosen entry id. The old name-based key is ignored. */
export const IDENTITY_KEY = "pickem:me";
export const LEAGUE_KEY = "pickem:league";
/** JSON list of `{ id, name }`, most recent first, for the league picker. */
export const RECENT_KEY = "pickem:recent";

async function fetchPool(leagueId: string): Promise<PoolModel> {
  const res = await fetch(`/api/pool?league=${encodeURIComponent(leagueId)}`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `Failed to load pool (${res.status})`);
  }
  return body as PoolModel;
}

/** Fetches one league. Disabled until a league id is known. */
export function usePool(leagueId: string | null) {
  return useQuery({
    queryKey: [POOL_KEY, leagueId],
    queryFn: () => fetchPool(leagueId as string),
    enabled: Boolean(leagueId),
    staleTime: 30_000,
  });
}

const indexCache = new WeakMap<PoolModel, PoolIndex>();

/** Memoized lookup structures over the pool model. */
export function usePoolIndex(pool: PoolModel | undefined): PoolIndex | null {
  if (!pool) return null;
  const hit = indexCache.get(pool);
  if (hit) return hit;
  const built = indexPool(pool);
  indexCache.set(pool, built);
  return built;
}

/**
 * The last league opened, so returning to the root URL goes straight back to it
 * instead of the setup screen. Deliberately not sent to the server.
 */
export function useStoredLeague() {
  const [league, setLeague] = useLocalValue(LEAGUE_KEY);
  return { league, setLeague };
}

export interface RecentLeague {
  id: string;
  name: string;
}

function parseRecent(raw: string | null): RecentLeague[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((l): l is RecentLeague => typeof l?.id === "string" && typeof l?.name === "string")
      : [];
  } catch {
    return [];
  }
}

/** Leagues opened on this device, with names, so switching back is one tap. */
export function useRecentLeagues() {
  const [raw, setRaw] = useLocalValue(RECENT_KEY);
  const recent = parseRecent(raw);
  const remember = useCallback(
    (league: RecentLeague) => {
      const list = parseRecent(raw);
      if (list[0]?.id === league.id && list[0]?.name === league.name) return;
      const next = [league, ...list.filter((l) => l.id !== league.id)].slice(0, 5);
      setRaw(JSON.stringify(next));
    },
    [raw, setRaw],
  );
  return { recent, remember };
}

/**
 * "Which entry is mine" is stored locally rather than authenticated, since the
 * whole point of the dashboard is that ESPN's pool data is public. It stores
 * the entry id: names repeat ("Sam's 1st Entry"), ids don't.
 */
export function useIdentity() {
  const [entryId, setEntryId] = useLocalValue(IDENTITY_KEY);
  return { entryId, setEntryId };
}

const peopleCache = new WeakMap<PoolModel, Map<string, Person>>();

/** Display names, initials and avatar colours for every entry. */
export function usePeople(pool: PoolModel | undefined): Map<string, Person> {
  if (!pool) return new Map();
  const hit = peopleCache.get(pool);
  if (hit) return hit;
  const built = buildPeople(pool.entries);
  peopleCache.set(pool, built);
  return built;
}

/** Ticks so "fetched 3m ago" labels stay accurate without a manual refresh. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function relativeAge(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
