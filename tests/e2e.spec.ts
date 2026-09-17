import { test, expect, type Page } from "@playwright/test";

const USER = process.env.AG_USER || "Артем";
const PASS = process.env.AG_PASS || "";
const BASE = process.env.AG_URL || "https://agentarium.alliancegroup95.com";

// Console/JS/API errors that are benign noise we don't want to fail on.
const BENIGN = [/favicon/i, /manifest/i, /ERR_INTERNET_DISCONNECTED/i];

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      if (!BENIGN.some((r) => r.test(t))) errors.push(`console.error: ${t}`);
    }
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/api/") && r.status() >= 500) errors.push(`API ${r.status()} ${u}`);
  });
  return errors;
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("ada.lovelace").fill(USER);
  await page.getByPlaceholder("••••••••").fill(PASS);
  await page.locator("button.btnp.block").click();
  await expect(page.locator(".applayout")).toBeVisible({ timeout: 15000 });
}

test("welcome page renders with no errors", async ({ page }) => {
  const errors = attachErrorCollector(page);
  await page.goto("/");
  await expect(page.getByPlaceholder("ada.lovelace")).toBeVisible();
  await page.waitForTimeout(1000);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("walk all authed screens with no console/JS/API errors", async ({ page }) => {
  test.skip(!PASS, "AG_PASS not provided");
  const errors = attachErrorCollector(page);
  await login(page);

  const routes = ["/", "/communities", "/friends", "/requests", "/search?q=a", `/profile/${USER}`, "/compose"];
  for (const r of routes) {
    await page.goto(r);
    await page.waitForTimeout(1200);
    // page must not be blank
    await expect(page.locator("body")).not.toBeEmpty();
  }
  // open the profile editor
  await page.goto(`/profile/${USER}`);
  await page.waitForTimeout(800);
  const editBtn = page.getByRole("button", { name: /Редагувати профіль|Edit profile/ });
  if (await editBtn.count()) {
    await editBtn.first().click();
    await expect(page.getByText(/Контакти|Contacts/).first()).toBeVisible();
  }

  expect(errors, "Collected errors:\n" + errors.join("\n")).toEqual([]);
});

test("create a post via UI, verify it appears, then clean up", async ({ page, request }) => {
  test.skip(!PASS, "AG_PASS not provided");
  const errors = attachErrorCollector(page);
  await login(page);

  const marker = "e2e-" + Date.now();
  await page.goto("/compose");
  await page.waitForTimeout(800);
  // title editor (first .rte), then body editor (second .rte)
  const editors = page.locator(".rte");
  await editors.nth(0).click();
  await editors.nth(0).type("bug-hunt " + marker);
  await editors.nth(1).click();
  await editors.nth(1).type("body of " + marker);
  await page.locator("button.btnp", { hasText: /Опублікувати|Publish/ }).click();

  // should land on the post detail page and show the title
  await expect(page.getByText("bug-hunt " + marker)).toBeVisible({ timeout: 15000 });

  // cleanup via API (login through request context)
  const jar = await request.post("/api/auth/login", { data: { nickname: USER, password: PASS }, headers: { Origin: process.env.AG_URL || "https://agentarium.alliancegroup95.com" } });
  expect(jar.ok()).toBeTruthy();
  const feed = await (await request.get("/api/posts")).json();
  const mine = feed.posts.find((p: any) => (p.title || "").includes(marker));
  if (mine) await request.delete(`/api/posts/${mine.id}`, { headers: { Origin: process.env.AG_URL || "https://agentarium.alliancegroup95.com" } });

  expect(errors, errors.join("\n")).toEqual([]);
});

test("interactions: community tabs, comment, profile save/revert", async ({ page, request }) => {
  test.skip(!PASS, "AG_PASS not provided");
  const errors = attachErrorCollector(page);
  await login(page);

  // community tab switching
  await page.goto("/communities");
  await page.waitForTimeout(800);
  const card = page.locator(".chunk.hoverrow").first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(800);
    const tabs = page.locator(".tab");
    if ((await tabs.count()) >= 2) {
      await tabs.nth(1).click();
      await page.waitForTimeout(400);
      await tabs.nth(0).click();
      await page.waitForTimeout(400);
    }
  }

  // create a post then comment on it
  const marker = "e2e2-" + Date.now();
  await page.goto("/compose");
  await page.waitForTimeout(600);
  const eds = page.locator(".rte");
  await eds.nth(0).click();
  await eds.nth(0).type("cm " + marker);
  await page.locator("button.btnp", { hasText: /Опублікувати|Publish/ }).click();
  await expect(page.getByText("cm " + marker)).toBeVisible({ timeout: 15000 });

  const commentBox = page.locator(".rte").first();
  await commentBox.click();
  await commentBox.type("hello " + marker);
  await page.locator("button.btnp", { hasText: /Надіслати|Send/ }).first().click();
  await expect(page.getByText("hello " + marker)).toBeVisible({ timeout: 20000 });

  // profile save + revert
  const origBio = (await (await request.get(`/api/profile/${USER}`)).json()).profile.bio || "";
  await page.goto(`/profile/${USER}`);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Редагувати профіль|Edit profile/ }).first().click();
  const bio = page.locator("textarea.finput").first();
  await bio.fill("bio " + marker);
  await page.getByRole("button", { name: /^Зберегти$|^Save$/ }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText("bio " + marker)).toBeVisible();

  // cleanup via API
  await request.post("/api/auth/login", { data: { nickname: USER, password: PASS }, headers: { Origin: BASE } });
  await request.put("/api/profile", { data: { bio: origBio }, headers: { Origin: BASE } });
  const feed = await (await request.get("/api/posts")).json();
  const mine = feed.posts.find((p: any) => (p.title || "").includes(marker));
  if (mine) await request.delete(`/api/posts/${mine.id}`, { headers: { Origin: BASE } });

  expect(errors, "Collected errors:\n" + errors.join("\n")).toEqual([]);
});
