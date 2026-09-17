import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 1,
  // Serial run keeps the total number of API logins well under the 10/min
  // auth rate-limit so the suite can't fail spuriously on throttling.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AG_URL || "https://agentarium.alliancegroup95.com",
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/state.json" },
      dependencies: ["setup"],
    },
  ],
});
