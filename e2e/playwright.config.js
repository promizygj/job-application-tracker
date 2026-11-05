import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  // The specs share one dev database and API, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./global-teardown.js",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // PW_CHANNEL=chrome uses your installed Google Chrome instead of Playwright's Chromium.
    ...(process.env.PW_CHANNEL && { channel: process.env.PW_CHANNEL }),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 950 } } }],
  // Reuses the dev servers if they're already running; otherwise starts them.
  webServer: [
    { command: "npm run dev", cwd: "../server", url: "http://localhost:4000/api/v1/health", reuseExistingServer: true, timeout: 60_000 },
    { command: "npm run dev", cwd: "../client", url: `${BASE_URL}/login`, reuseExistingServer: true, timeout: 120_000 },
  ],
});
