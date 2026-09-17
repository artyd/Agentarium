import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AG_URL || "https://agentarium.alliancegroup95.com",
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
