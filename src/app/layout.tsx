import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { LeagueNav } from "@/components/LeagueNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pick'em Confidence Dashboard",
  description:
    "Pick distribution, confidence analysis, and what-if standings for any ESPN Pick'em confidence pool.",
};

export const viewport: Viewport = {
  themeColor: "#080b12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--surface-0)_92%,transparent)] backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-6 sm:px-4 sm:py-3">
              <span className="min-w-0 shrink-0 text-sm font-semibold tracking-tight">
                <span className="sm:hidden">Pick&apos;em</span>
                <span className="hidden sm:inline">Confidence Pool</span>
              </span>
              <Suspense fallback={<nav className="ml-auto h-9" />}>
                <LeagueNav />
              </Suspense>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-7xl px-3 py-6 text-[11px] leading-relaxed text-[var(--faint)] sm:px-4">
            Data from ESPN&apos;s public Pick&apos;em API. Unofficial and not affiliated
            with ESPN. No account, database, or league is configured on this
            server.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
