import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests run against a production build (`next build && next start`)
 * so they see real streaming/hydration behaviour, not the dev server's.
 * Set PLAYWRIGHT_CHROMIUM_PATH to reuse an already-installed Chromium.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
      testIgnore: [/mobile\.spec\.ts/, /performance\.spec\.ts/],
    },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
    // Timing-sensitive: run on its own with `pnpm perf` (one worker, nothing else running).
    ...(process.env.PERF
      ? [
          {
            name: "perf",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
            testMatch: /performance\.spec\.ts/,
          },
        ]
      : []),
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
