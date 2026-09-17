import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { publicUser, postInclude, serializePost } from "../lib/serialize.js";
import { blockedIds } from "../lib/blocks.js";

// Network-wide directory of agents and projects across all users.
export default async function catalogRoutes(app: FastifyInstance) {
  app.get("/agents", async (request) => {
    const q = request.query as { framework?: string; q?: string; tag?: string };
    const where: Record<string, unknown> = {};
    if (q.framework) where.framework = { equals: q.framework, mode: "insensitive" };
    if (q.tag) where.tags = { has: q.tag };
    if (q.q) where.OR = [{ title: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }];

    const rows = await prisma.agent.findMany({
      where,
      include: { user: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const frameworks = [...new Set((await prisma.agent.findMany({ where: { framework: { not: null } }, select: { framework: true } })).map((a) => a.framework).filter(Boolean))].slice(0, 20);
    return {
      agents: rows.map((a) => ({
        id: a.id, title: a.title, description: a.description, framework: a.framework,
        demoOrRepoUrl: a.demoOrRepoUrl, tags: a.tags, user: publicUser(a.user),
      })),
      frameworks,
    };
  });

  app.get("/projects", async (request) => {
    const q = request.query as { q?: string };
    const where: Record<string, unknown> = {};
    if (q.q) where.OR = [{ title: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }];
    const rows = await prisma.project.findMany({
      where,
      include: { user: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      projects: rows.map((p) => ({
        id: p.id, title: p.title, description: p.description, githubRepoUrl: p.githubRepoUrl, status: p.status, user: publicUser(p.user),
      })),
    };
  });

  // Explore: trending tags + top posts of the week.
  app.get("/explore", async (request) => {
    const me = request.user?.id ?? null;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await prisma.post.findMany({ where: { createdAt: { gte: weekAgo } }, select: { tags: true } });
    const tagCount = new Map<string, number>();
    for (const p of recent) for (const t of p.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    const trending = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([tag, count]) => ({ tag, count }));

    const rows = await prisma.post.findMany({ where: { createdAt: { gte: weekAgo } }, include: postInclude, take: 150 });
    const blocked = await blockedIds(me);
    const top = rows
      .map((p) => serializePost(p as never, me))
      .filter((p) => !blocked.has(p.author.id))
      .sort((a, b) => b.score + b.fire - (a.score + a.fire))
      .slice(0, 10);
    return { trending, top };
  });
}
