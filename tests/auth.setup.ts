import { test as setup, expect } from "@playwright/test";

const USER = process.env.AG_USER || "Артем";
const PASS = process.env.AG_PASS || "";
const BASE = process.env.AG_URL || "https://agentarium.alliancegroup95.com";

export const STATE_PATH = ".auth/state.json";

/** Authenticate once via the API and persist the session cookie. Every test then
 *  reuses this storageState instead of submitting the login form, so the suite
 *  no longer trips the login rate-limit (10/min per IP) and fails spuriously. */
setup("authenticate", async ({ request }) => {
  setup.skip(!PASS, "AG_PASS not provided");
  const res = await request.post("/api/auth/login", {
    data: { nickname: USER, password: PASS },
    headers: { Origin: BASE },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  await request.storageState({ path: STATE_PATH });
});
