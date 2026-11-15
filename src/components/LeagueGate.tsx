"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LeaguePicker } from "@/components/LeaguePicker";
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
  return (
    <div className="px-4 pt-10">
      <h1 className="px-1 text-[32px] font-extrabold leading-tight tracking-[-0.8px]">
        Find your pool
      </h1>
      <p className="mt-2 px-1 text-[15px] leading-relaxed text-muted">
        Search for your ESPN Pick&apos;em group by name.
      </p>
      <div className="card mt-5 p-4">
        <LeaguePicker />
      </div>
    </div>
  );
}
