"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui";
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
    <div className="mx-auto max-w-lg py-6 sm:py-12">
      <Card className="p-5 sm:p-6">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          Point this at a league
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Paste the league id from your ESPN Pick&apos;em group URL. The league has
          to be public; nothing is stored on a server and no league is configured
          in the app.
        </p>

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            setLeague(trimmed);
            router.push(`/?league=${encodeURIComponent(trimmed)}`);
          }}
        >
          <label
            htmlFor={inputId}
            className="block text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]"
          >
            League id
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id={inputId}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[#e8eaf0] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={!valid}
              className="shrink-0 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#06121f] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Open
            </button>
          </div>
        </form>

        {league ? (
          <button
            type="button"
            onClick={() => router.push(`/?league=${encodeURIComponent(league)}`)}
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-sm transition-colors hover:border-[var(--accent)]"
          >
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wider text-[var(--faint)]">
                Last opened
              </span>
              <span className="num block truncate text-[var(--muted)]">{league}</span>
            </span>
            <span className="shrink-0 text-[var(--accent)]">Open →</span>
          </button>
        ) : null}

        <details className="mt-5 text-sm text-[var(--muted)]">
          <summary className="cursor-pointer text-[var(--muted)]">
            Where do I find the league id?
          </summary>
          <p className="mt-2 leading-relaxed">
            Open your group on espn.com. The id is the last segment of the URL,
            after <code className="text-[var(--faint)]">/group/</code>:
          </p>
          <p className="num mt-2 break-all rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--faint)]">
            fantasy.espn.com/football/pickem/…/group/&lt;league-id&gt;
          </p>
        </details>
      </Card>
    </div>
  );
}
