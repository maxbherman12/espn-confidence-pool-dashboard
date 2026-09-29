import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  // Vitest does not read .env.local by default, so the live test suite would
  // always skip. Fall back to the same values the app uses.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      // Live upstream calls; give the season archive time to download.
      testTimeout: 60_000,
      hookTimeout: 60_000,
      // The suite needs a real public league to verify against. Nothing is
      // committed, so this is empty unless the developer supplies one.
      env: {
        TEST_LEAGUE_ID: process.env.TEST_LEAGUE_ID ?? env.TEST_LEAGUE_ID ?? "",
      },
    },
  };
});
