import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { encrypt } from "../lib/crypto.js";
import { requireAuth } from "../lib/session.js";
import { env } from "../lib/env.js";

type Repo = { name: string; commits: string };

async function fetchRepos(token: string): Promise<Repo[]> {
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=8&visibility=public", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "agentarium" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { name: string; stargazers_count: number; language: string | null }[];
  return json.map((r) => ({
    name: r.name,
    commits: r.language ? `${r.language} · ★ ${r.stargazers_count}` : `★ ${r.stargazers_count}`,
  }));
}

export default async function githubRoutes(app: FastifyInstance) {
  // Manual mode: just store the profile URL (no GitHub API calls).
  app.post("/github/link-manual", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ url: z.string().min(4).max(300) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { githubUrl: parsed.data.url, githubMode: "manual" },
    });
    return reply.send({ ok: true, githubUrl: parsed.data.url });
  });

  app.post("/github/disconnect", { preHandler: requireAuth }, async (request, reply) => {
    await prisma.user.update({
      where: { id: request.user!.id },
      data: {
        githubConnected: false,
        githubMode: null,
        githubUsername: null,
        githubUrl: null,
        githubAccessToken: null,
        githubReposCache: undefined,
        githubCachedAt: null,
      },
    });
    return reply.send({ ok: true });
  });

  // Start OAuth: redirect the browser to GitHub's authorize page.
  app.get("/github/connect", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.GITHUB_CLIENT_ID) return reply.code(501).send({ error: "github oauth not configured" });
    const state = randomBytes(16).toString("hex");
    await redis.set(`ghstate:${state}`, request.user!.id, { EX: 600 });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GITHUB_CALLBACK_URL);
    url.searchParams.set("scope", "read:user");
    url.searchParams.set("state", state);
    return reply.redirect(url.toString());
  });

  // OAuth callback: exchange code, fetch profile + public repos, store encrypted token.
  app.get("/github/callback", async (request, reply) => {
    const q = request.query as { code?: string; state?: string };
    if (!q.code || !q.state) return reply.code(400).send({ error: "missing code/state" });
    const userId = await redis.get(`ghstate:${q.state}`);
    if (!userId) return reply.code(400).send({ error: "invalid state" });
    await redis.del(`ghstate:${q.state}`);

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: q.code,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const token = tokenJson.access_token;
    if (!token) return reply.redirect(`${env.PUBLIC_URL}/?github=error`);

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "agentarium" },
    });
    const ghUser = (await userRes.json()) as { login?: string; html_url?: string };
    const repos = await fetchRepos(token);

    await prisma.user.update({
      where: { id: userId },
      data: {
        githubConnected: true,
        githubMode: "oauth",
        githubUsername: ghUser.login ?? null,
        githubUrl: ghUser.html_url ?? null,
        githubAccessToken: encrypt(token),
        githubReposCache: repos,
        githubCachedAt: new Date(),
      },
    });

    const me = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
    return reply.redirect(`${env.PUBLIC_URL}/profile/${me?.nickname ?? ""}?github=connected`);
  });
}
