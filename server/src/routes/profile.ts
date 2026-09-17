import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cleanText } from "../lib/sanitize.js";
import { requireAuth } from "../lib/session.js";
import { postInclude, serializePost } from "../lib/serialize.js";
import { checkAchievements } from "../lib/achievements.js";

export default async function profileRoutes(app: FastifyInstance) {
  app.get("/profile/:nickname", async (request, reply) => {
    const nickname = (request.params as { nickname: string }).nickname;
    const u = await prisma.user.findUnique({
      where: { nickname },
      include: {
        projects: { orderBy: { createdAt: "desc" } },
        agents: { orderBy: { createdAt: "desc" } },
        skills: true,
        achievements: { include: { achievement: true } },
      },
    });
    if (!u) return reply.code(404).send({ error: "not found" });

    const posts = await prisma.post.findMany({
      where: { authorId: u.id },
      include: postInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const isMe = request.user?.id === u.id;
    const repos = (u.githubReposCache as { name: string; commits?: string }[] | null) ?? [];
    const [followerCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: u.id } }),
      prisma.follow.count({ where: { followerId: u.id } }),
    ]);
    let isFollowing = false;
    let isBlocked = false;
    if (request.user && !isMe) {
      isFollowing = !!(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: request.user.id, followingId: u.id } } }));
      isBlocked = !!(await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: request.user.id, blockedId: u.id } } }));
    }

    return {
      profile: {
        id: u.id,
        nickname: u.nickname,
        bio: u.bio,
        avatarUrl: u.avatarUrl,
        socialLinks: u.socialLinks,
        githubConnected: u.githubConnected,
        githubMode: u.githubMode,
        githubUsername: u.githubUsername,
        githubUrl: u.githubUrl,
        githubRepos: u.githubConnected ? repos : [],
        isMe,
        isFollowing,
        isBlocked,
        followerCount,
        followingCount,
      },
      posts: posts.map((p) => serializePost(p as never, request.user?.id ?? null)),
      projects: u.projects,
      agents: u.agents,
      skills: u.skills.map((s) => s.tag),
      achievements: u.achievements.map((a) => ({
        code: a.achievement.code,
        title: a.achievement.title,
        icon: a.achievement.icon,
        earnedAt: a.earnedAt.toISOString(),
      })),
    };
  });

  app.put("/profile", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        bio: z.string().max(400).optional(),
        avatarUrl: z.string().max(500).optional().nullable(),
        socialLinks: z.array(z.string().max(200)).max(8).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const u = await prisma.user.update({
      where: { id: request.user!.id },
      data: {
        ...(parsed.data.bio !== undefined ? { bio: cleanText(parsed.data.bio) } : {}),
        ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
        ...(parsed.data.socialLinks !== undefined ? { socialLinks: parsed.data.socialLinks.map(cleanText) } : {}),
      },
    });
    return reply.send({ ok: true, bio: u.bio, socialLinks: u.socialLinks });
  });

  // Projects
  app.post("/profile/projects", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        title: z.string().min(1).max(120),
        description: z.string().max(600).optional().default(""),
        githubRepoUrl: z.string().max(300).optional().nullable(),
        status: z.string().max(40).optional().nullable(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const p = await prisma.project.create({
      data: {
        userId: request.user!.id,
        title: cleanText(parsed.data.title),
        description: cleanText(parsed.data.description),
        githubRepoUrl: parsed.data.githubRepoUrl ?? null,
        status: parsed.data.status ? cleanText(parsed.data.status) : null,
      },
    });
    return reply.send({ project: p });
  });

  app.delete("/profile/projects/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    await prisma.project.deleteMany({ where: { id, userId: request.user!.id } });
    return reply.send({ ok: true });
  });

  // Agents
  app.post("/profile/agents", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        title: z.string().min(1).max(120),
        description: z.string().max(600).optional().default(""),
        framework: z.string().max(60).optional().nullable(),
        demoOrRepoUrl: z.string().max(300).optional().nullable(),
        tags: z.array(z.string().max(30)).max(10).optional().default([]),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const a = await prisma.agent.create({
      data: {
        userId: request.user!.id,
        title: cleanText(parsed.data.title),
        description: cleanText(parsed.data.description),
        framework: parsed.data.framework ? cleanText(parsed.data.framework) : null,
        demoOrRepoUrl: parsed.data.demoOrRepoUrl ?? null,
        tags: parsed.data.tags.map(cleanText),
      },
    });
    await checkAchievements(request.user!.id, "agent");
    return reply.send({ agent: a });
  });

  app.delete("/profile/agents/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    await prisma.agent.deleteMany({ where: { id, userId: request.user!.id } });
    return reply.send({ ok: true });
  });

  // Skills
  app.post("/profile/skills", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ tag: z.string().min(1).max(40) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    await prisma.skill
      .create({ data: { userId: request.user!.id, tag: cleanText(parsed.data.tag) } })
      .catch(() => {});
    return reply.send({ ok: true });
  });

  app.delete("/profile/skills/:tag", { preHandler: requireAuth }, async (request, reply) => {
    const tag = decodeURIComponent((request.params as { tag: string }).tag);
    await prisma.skill.deleteMany({ where: { userId: request.user!.id, tag } });
    return reply.send({ ok: true });
  });
}
