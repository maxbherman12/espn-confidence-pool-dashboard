import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/BottomNav";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pick'em Pool",
  description:
    "Standings, picks, what-ifs and season trends for an ESPN Pick'em confidence pool.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <main className="pb-nav mx-auto w-full max-w-xl">{children}</main>
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
