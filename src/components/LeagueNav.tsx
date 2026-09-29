"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/", label: "Distribution" },
  { href: "/whatif", label: "What if" },
] as const;

/**
 * Nav that carries the `league` param across, so switching tabs never drops you
 * back to the setup screen. Anything else in the query string (the what-if
 * scenario) is intentionally not propagated - leaving a scenario behind would
 * make the other tab look wrong.
 *
 * Sits in a `<Suspense>` boundary in the layout because it reads search params.
 */
export function LeagueNav() {
  const search = useSearchParams();
  const pathname = usePathname();
  const league = search.get("league");

  const hrefFor = (href: string) =>
    league ? `${href}?league=${encodeURIComponent(league)}` : href;

  return (
    <>
      <nav className="scroller -mx-1 flex min-w-0 items-center gap-0.5 px-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={hrefFor(item.href)}
              aria-current={active ? "page" : undefined}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors sm:min-h-0 ${
                active
                  ? "bg-[var(--surface-3)] text-[var(--text)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/?new=1"
        className="min-h-10 shrink-0 rounded-md px-2 py-1.5 text-xs text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] sm:ml-auto sm:text-sm"
      >
        League
      </Link>
    </>
  );
}
