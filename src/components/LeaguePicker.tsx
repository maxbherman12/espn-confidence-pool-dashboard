"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { GroupHit, GroupSearchResult } from "@/app/api/groups/route";
import { useIdentity, useRecentLeagues, useStoredLeague, type RecentLeague } from "@/lib/hooks";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The league id inside anything pasted: a bare id, a group URL, an invite link. */
export function leagueIdFrom(text: string): string | null {
  return text.match(UUID)?.[0].toLowerCase() ?? null;
}

/**
 * Opens a league. Always clears "which one is you", so whoever picks a league
 * (even the same one again) is asked who they are next. That is also the way
 * to switch person.
 */
export function useChooseLeague() {
  const router = useRouter();
  const pathname = usePathname();
  const { setEntryId } = useIdentity();
  const { setLeague } = useStoredLeague();
  return (id: string) => {
    setEntryId(null);
    setLeague(id);
    router.push(`${pathname}?league=${encodeURIComponent(id)}`);
  };
}

async function search(q: string): Promise<GroupSearchResult> {
  const res = await fetch(`/api/groups?q=${encodeURIComponent(q)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `Search failed (${res.status})`);
  return body as GroupSearchResult;
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * One box for a group name or a pasted link. Typing a name searches ESPN's
 * group list; pasting anything with a league id in it offers to open it.
 * `current` pins the league being viewed at the top and pre-fills its name.
 */
export function LeaguePicker({
  current,
  onChosen,
  autoFocus = false,
}: {
  current?: RecentLeague | null;
  onChosen?: () => void;
  autoFocus?: boolean;
}) {
  const choose = useChooseLeague();
  const { recent } = useRecentLeagues();
  const [value, setValue] = useState(current?.name ?? "");
  const inputId = useId();

  const pastedId = leagueIdFrom(value);
  const q = useDebounced(pastedId ? "" : value.trim(), 300);
  const searching = q.length >= 2;
  const { data, error, isFetching } = useQuery({
    queryKey: ["groups", q],
    queryFn: () => search(q),
    enabled: searching,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const open = (id: string) => {
    choose(id);
    onChosen?.();
  };

  const hits = searching ? (data?.groups ?? []).filter((g) => g.id !== current?.id) : [];
  const others = recent.filter((l) => l.id !== current?.id);

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        Group name or link
      </label>
      <div className="relative">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          autoFocus={autoFocus}
          placeholder="Group name, or paste the link"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-12 w-full rounded-xl bg-soft pl-10 pr-10 text-base outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear"
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center text-faint"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </div>

      {current ? (
        <Section title="Current league">
          <Row
            title={current.name}
            sub="Keep this league and pick who you are"
            action="Keep"
            onClick={() => open(current.id)}
            highlight
          />
        </Section>
      ) : null}

      {pastedId ? (
        <Section title="From your link">
          <Row title="Open this league" sub={pastedId} action="Open" onClick={() => open(pastedId)} highlight />
        </Section>
      ) : searching ? (
        <Section
          title={
            data && !isFetching && data.total > hits.length
              ? `${data.total.toLocaleString()} groups match · showing the biggest`
              : "Matching groups"
          }
          busy={isFetching}
        >
          {error ? (
            <p className="px-4 py-3 text-sm text-loss">{(error as Error).message}</p>
          ) : hits.length ? (
            hits.map((g, i) => <GroupRow key={g.id} group={g} index={i} onClick={() => open(g.id)} />)
          ) : !isFetching ? (
            <p className="px-4 py-3 text-sm text-muted">
              No groups with that name. Try part of it, or paste the group&apos;s link.
            </p>
          ) : null}
        </Section>
      ) : others.length ? (
        <Section title="Recent">
          {others.map((l) => (
            <Row key={l.id} title={l.name} action="Open" onClick={() => open(l.id)} />
          ))}
        </Section>
      ) : null}

      {!searching && !pastedId ? (
        <p className="mt-4 px-1 text-sm leading-relaxed text-muted">
          Type your group&apos;s name as it shows on ESPN, or copy the group&apos;s link
          from the ESPN app or site and paste it here. Groups hidden from ESPN&apos;s
          search only open from a link.
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, busy = false, children }: { title: string; busy?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="flex items-center gap-2 px-1 pb-1.5 text-[13px] font-semibold text-muted">
        {title}
        {busy ? <span className="size-3 animate-spin rounded-full border-2 border-mark border-t-accent" aria-label="Searching" /> : null}
      </h2>
      <ul className="overflow-hidden rounded-2xl bg-soft">{children}</ul>
    </section>
  );
}

function Row({
  title,
  sub,
  action,
  onClick,
  highlight = false,
}: {
  title: string;
  sub?: string;
  action: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <li className="border-b border-line last:border-0">
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-line">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{title}</span>
          {sub ? <span className="block truncate text-xs text-muted">{sub}</span> : null}
        </span>
        <span className={`shrink-0 text-sm font-semibold ${highlight ? "rounded-full bg-accent px-3 py-1.5 text-white" : "text-accent"}`}>
          {action}
        </span>
      </button>
    </li>
  );
}

function GroupRow({ group, index, onClick }: { group: GroupHit; index: number; onClick: () => void }) {
  return (
    <motion.li
      className="border-b border-line last:border-0"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
    >
      <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-line">
        <GroupLogo group={group} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{group.name}</span>
            {group.confidence ? (
              <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                Confidence
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted">
            {group.size.toLocaleString()} {group.size === 1 ? "member" : "members"}
            {group.creator ? ` · by ${group.creator}` : ""}
          </span>
        </span>
        <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mark)" strokeWidth="2.5" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </motion.li>
  );
}

function GroupLogo({ group }: { group: GroupHit }) {
  const [broken, setBroken] = useState(false);
  if (group.logo && !broken) {
    return (
      // ESPN CDN images via a plain <img>, like team logos.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={group.logo}
        alt=""
        width={36}
        height={36}
        onError={() => setBroken(true)}
        className="size-9 shrink-0 rounded-full bg-card object-cover"
      />
    );
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-sm font-bold text-muted">
      {group.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
