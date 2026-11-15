"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Standings",
    icon: (
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3a3 3 0 0 1-3 3M7 6H4a3 3 0 0 0 3 3" />
    ),
  },
  {
    href: "/games",
    label: "Games",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M12 5v14M3 12h4M17 12h4" />
      </>
    ),
  },
  { href: "/whatif", label: "What if", icon: <path d="M4 7h11l-3-3M20 17H9l3 3" /> },
  { href: "/season", label: "Season", icon: <path d="M4 19l5-6 4 3 7-9" /> },
] as const;

/**
 * Bottom tab bar. Carries the `league` param so switching tabs never drops you
 * back to the setup screen. Hidden on the setup screen itself.
 */
export function BottomNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const league = search.get("league");
  if (search.get("new")) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line backdrop-blur-xl"
      style={{ background: "var(--nav)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={league ? `${tab.href}?league=${encodeURIComponent(league)}` : tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {tab.icon}
              </svg>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
