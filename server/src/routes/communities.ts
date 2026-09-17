import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cleanText } from "../lib/sanitize.js";
import { requireAuth } from "../lib/session.js";
import { nestComments, commentInclude, publicUser } from "../lib/serialize.js";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "community";
}

export default async function communityRoutes(app: FastifyInstance) {
  app.get("/communities", async (request) => {
    const rows = await prisma.community.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true, threads: true } } },
    });
    const myMemberships = request.user
      ? new Set(
          (
            await prisma.communityMember.findMany({
              where: { userId: request.user.id },
              select: { communityId: true },
            })
          ).map((m) => m.communityId),
        )
      : new Set<string>();
    return {
      communities: rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        isPrivate: c.isPrivate,
        memberCount: c._count.members,
        threadCount: c._count.threads,
        isMember: myMemberships.has(c.id),
      })),
    };
  });

  app.get("/communities/:slug", async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const c = await prisma.community.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, nickname: true, avatarUrl: true, bio: true } },
        _count: { select: { members: true } },
        threads: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, nickname: true, avatarUrl: true, bio: true } },
            _count: { select: { comments: true } },
          },
        },
      },
    });
    if (!c) return reply.code(404).send({ error: "not found" });
    const isMember = request.user
      ? !!(await prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId: c.id, userId: request.user.id } },
        }))
      : false;
    return {
      community: {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        isPrivate: c.isPrivate,
        owner: publicUser(c.owner),
        memberCount: c._count.members,
        isMember,
      },
      threads: c.threads.map((t) => ({
        id: t.id,
        title: t.title,
        author: publicUser(t.author),
        commentCount: t._count.comments,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });

  app.post("/communities", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        title: z.string().min(2).max(80),
        description: z.string().max(500).optional().default(""),
        isPrivate: z.boolean().optional().default(false),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });

    let slug = slugify(parsed.data.title);
    if (await prisma.community.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const c = await prisma.community.create({
      data: {
        slug,
        title: cleanText(parsed.data.title),
        description: cleanText(parsed.data.description),
        isPrivate: parsed.data.isPrivate,
        ownerId: request.user!.id,
        members: { create: { userId: request.user!.id, role: "owner" } },
      },
    });
    return reply.send({ community: { id: c.id, slug: c.slug, title: c.title } });
  });

  app.post("/communities/:slug/join", { preHandler: requireAuth }, async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const c = await prisma.community.findUnique({ where: { slug } });
    if (!c) return reply.code(404).send({ error: "not found" });
    await prisma.communityMember
      .create({ data: { communityId: c.id, userId: request.user!.id, role: "member" } })
      .catch(() => {});
    return reply.send({ ok: true });
  });

  app.post("/communities/:slug/invite", { preHandler: requireAuth }, async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const parsed = z.object({ userId: z.string() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const c = await prisma.community.findUnique({ where: { slug } });
    if (!c) return reply.code(404).send({ error: "not found" });
    await prisma.communityInvite
      .create({
        data: { communityId: c.id, invitedUserId: parsed.data.userId, invitedById: request.user!.id },
      })
      .catch(() => {});
    return reply.send({ ok: true });
  });

  // ── Threads ──
  app.post("/communities/:slug/threads", { preHandler: requireAuth }, async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const parsed = z.object({ title: z.string().min(2).max(200) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const c = await prisma.community.findUnique({ where: { slug } });
    if (!c) return reply.code(404).send({ error: "not found" });
    const member = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: c.id, userId: request.user!.id } },
    });
    if (!member) return reply.code(403).send({ error: "not a member" });
    const t = await prisma.thread.create({
      data: { communityId: c.id, authorId: request.user!.id, title: cleanText(parsed.data.title) },
    });
    return reply.send({ thread: { id: t.id, title: t.title } });
  });

  app.get("/threads/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const t = await prisma.thread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, nickname: true, avatarUrl: true, bio: true } },
        community: { select: { slug: true, title: true } },
      },
    });
    if (!t) return reply.code(404).send({ error: "not found" });
    const comments = await prisma.comment.findMany({
      where: { threadId: id },
      include: commentInclude,
      orderBy: { createdAt: "asc" },
    });
    return {
      thread: {
        id: t.id,
        title: t.title,
        author: publicUser(t.author),
        community: { slug: t.community.slug, title: t.community.title },
        createdAt: t.createdAt.toISOString(),
      },
      comments: nestComments(comments as never),
    };
  });
}
