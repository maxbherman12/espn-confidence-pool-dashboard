"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useStoredLeague } from "@/lib/hooks";

/**
 * The league id lives in the `league` query param, and the URL is the only
 * place it exists: nothing is configured server-side, so the same deployment
 * serves any number of leagues and a link to one is a complete reference.
 *
 * `?new=1` suppresses the "resume last league" redirect so the setup form can
 * be shown deliberately.
 */
export function useLeagueParam(): {
  leagueId: string | null;
  choose: (leagueId: string) => void;
  changeLeague: () => void;
} {
  const router = useRouter();
  const search = useSearchParams();
  const { league, setLeague } = useStoredLeague();

  const fromUrl = search.get("league")?.trim() ?? "";
  const leagueId = fromUrl || (search.get("new") ? "" : (league ?? ""));
  const leagueIdOrNull = leagueId || null;

  // Keep the remembered league in step with the URL in both directions.
  useEffect(() => {
    if (fromUrl && fromUrl !== league) setLeague(fromUrl);
  }, [fromUrl, league, setLeague]);

  return {
    leagueId: leagueIdOrNull,
    choose: (next: string) => router.push(`/?league=${encodeURIComponent(next)}`),
    changeLeague: () => router.push("/?new=1"),
  };
}

/**
 * Wraps the two data pages: shows the setup screen until a league is known.
 * Must sit under a `<Suspense>` boundary because it reads search params.
 */
export function LeagueGate({ children }: { children: React.ReactNode }) {
  const { leagueId } = useLeagueParam();
  if (!leagueId) return <LeagueSetup />;
  return <>{children}</>;
}

function LeagueSetup() {
  const router = useRouter();
  const { league, setLeague } = useStoredLeague();
  const [value, setValue] = useState("");
  const inputId = useId();

  const trimmed = value.trim();
  const valid = trimmed.length > 0;

  return (
    <div className="px-4 pt-10">
      <h1 className="px-1 text-[32px] font-extrabold leading-tight tracking-[-0.8px]">
        Open your pool
      </h1>
      <p className="mt-2 px-1 text-[15px] leading-relaxed text-muted">
        Paste the league id from your ESPN Pick&apos;em group link. The league has to
        be public.
      </p>

      <form
        className="card mt-5 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          setLeague(trimmed);
          router.push(`/?league=${encodeURIComponent(trimmed)}`);
        }}
      >
        <label htmlFor={inputId} className="block text-[13px] font-semibold text-muted">
          League id
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="mt-2 min-h-12 w-full rounded-xl bg-soft px-3 text-base outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!valid}
          className="mt-3 min-h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
        >
          Open
        </button>
      </form>

      {league ? (
        <button
          type="button"
          onClick={() => router.push(`/?league=${encodeURIComponent(league)}`)}
          className="card mt-3 flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-muted">Last opened</span>
            <span className="block truncate text-sm">{league}</span>
          </span>
          <span className="shrink-0 font-semibold text-accent">Open</span>
        </button>
      ) : null}

      <details className="mt-5 px-1 text-sm text-muted">
        <summary className="cursor-pointer font-semibold">Where do I find it?</summary>
        <p className="mt-2 leading-relaxed">
          Open your group on espn.com. The id is the last part of the URL, after{" "}
          <code>/group/</code>:
        </p>
        <p className="mt-2 break-all rounded-xl bg-card px-3 py-2 text-xs text-faint">
          fantasy.espn.com/football/pickem/…/group/&lt;league-id&gt;
        </p>
      </details>
    </div>
  );
}
