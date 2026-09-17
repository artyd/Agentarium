import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cleanHtml, cleanText, cleanInline } from "../lib/sanitize.js";
import { requireAuth } from "../lib/session.js";
import { postInclude, serializePost, nestComments, commentInclude } from "../lib/serialize.js";
import { checkAchievements } from "../lib/achievements.js";

const POST_TYPES = ["agent", "project", "article", "skill", "thought"] as const;

const createSchema = z.object({
  type: z.enum(POST_TYPES),
  title: z.string().min(1).max(200),
  bodyHtml: z.string().max(20000).optional().default(""),
  codeSnippet: z.string().max(20000).optional().nullable(),
  linkUrl: z.string().url().max(500).optional().nullable(),
  linkTitle: z.string().max(200).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  communityId: z.string().optional().nullable(),
});

// Reddit "hot" ranking: log-scaled engagement + time. Fresh posts float up, but a
// post with many upvotes/🔥 stays near the top for longer (each 10× engagement ≈
// ~12.5h of extra staying power). engagement = (upvotes − downvotes) + 🔥 reactions.
const REDDIT_EPOCH = 1_134_028_003; // seconds
function hotScore(engagement: number, createdAt: string): number {
  const order = Math.log10(Math.max(Math.abs(engagement), 1));
  const sign = engagement > 0 ? 1 : engagement < 0 ? -1 : 0;
  const seconds = new Date(createdAt).getTime() / 1000 - REDDIT_EPOCH;
  return sign * order + seconds / 45_000;
}

export default async function postRoutes(app: FastifyInstance) {
  // Feed / list with sort + filters.
  app.get("/posts", async (request) => {
    const q = request.query as { sort?: string; type?: string; community?: string; author?: string };
    const where: Record<string, unknown> = {};
    if (q.type && POST_TYPES.includes(q.type as (typeof POST_TYPES)[number])) where.type = q.type;
    if (q.community) where.community = { slug: q.community };
    if (q.author) where.author = { nickname: q.author };

    const rows = await prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    let posts = rows.map((p) => serializePost(p as never, request.user?.id ?? null));

    const sort = q.sort ?? "hot";
    if (sort === "new") posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === "top") posts.sort((a, b) => b.score + b.fire - (a.score + a.fire));
    else posts.sort((a, b) => hotScore(b.score + b.fire, b.createdAt) - hotScore(a.score + a.fire, a.createdAt));

    return { posts };
  });

  app.get("/posts/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const p = await prisma.post.findUnique({ where: { id }, include: postInclude });
    if (!p) return reply.code(404).send({ error: "not found" });
    const comments = await prisma.comment.findMany({
      where: { postId: id },
      include: commentInclude,
      orderBy: { createdAt: "asc" },
    });
    return {
      post: serializePost(p as never, request.user?.id ?? null),
      comments: nestComments(comments as never),
    };
  });

  app.post("/posts", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const d = parsed.data;

    if (d.communityId) {
      const member = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: d.communityId, userId: request.user!.id } },
      });
      if (!member) return reply.code(403).send({ error: "not a community member" });
    }

    const post = await prisma.post.create({
      data: {
        authorId: request.user!.id,
        type: d.type,
        title: cleanInline(d.title),
        bodyHtml: cleanHtml(d.bodyHtml ?? ""),
        codeSnippet: d.codeSnippet ? cleanText(d.codeSnippet) : null,
        linkUrl: d.linkUrl ?? null,
        linkTitle: d.linkTitle ? cleanText(d.linkTitle) : null,
        imageUrl: d.imageUrl ?? null,
        communityId: d.communityId ?? null,
      },
      include: postInclude,
    });
    await checkAchievements(request.user!.id, "post");
    return reply.send({ post: serializePost(post as never, request.user!.id) });
  });

  app.put("/posts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const parsed = z
      .object({
        title: z.string().min(1).max(2000).optional(),
        bodyHtml: z.string().max(20000).optional(),
        codeSnippet: z.string().max(20000).optional().nullable(),
        linkUrl: z.string().url().max(500).optional().nullable(),
        imageUrl: z.string().max(500).optional().nullable(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) return reply.code(404).send({ error: "not found" });
    if (post.authorId !== request.user!.id) return reply.code(403).send({ error: "forbidden" });
    const d = parsed.data;
    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: cleanInline(d.title) } : {}),
        ...(d.bodyHtml !== undefined ? { bodyHtml: cleanHtml(d.bodyHtml) } : {}),
        ...(d.codeSnippet !== undefined ? { codeSnippet: d.codeSnippet ? cleanText(d.codeSnippet) : null } : {}),
        ...(d.linkUrl !== undefined ? { linkUrl: d.linkUrl } : {}),
        ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl } : {}),
      },
      include: postInclude,
    });
    return reply.send({ post: serializePost(updated as never, request.user!.id) });
  });

  app.delete("/posts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const p = await prisma.post.findUnique({ where: { id } });
    if (!p) return reply.code(404).send({ error: "not found" });
    if (p.authorId !== request.user!.id) return reply.code(403).send({ error: "forbidden" });
    await prisma.post.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // Vote: value ∈ {1,-1,0}. 0 clears the vote.
  app.post("/posts/:id/vote", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const parsed = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const value = parsed.data.value;
    const key = { postId_userId: { postId: id, userId: request.user!.id } };
    if (value === 0) {
      await prisma.postVote.deleteMany({ where: { postId: id, userId: request.user!.id } });
    } else {
      await prisma.postVote.upsert({
        where: key,
        create: { postId: id, userId: request.user!.id, value },
        update: { value },
      });
    }
    const votes = await prisma.postVote.findMany({ where: { postId: id }, select: { value: true } });
    return reply.send({ score: votes.reduce((s, v) => s + v.value, 0), myVote: value });
  });

  // Toggle 🔥 reaction.
  app.post("/posts/:id/react", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const emoji = "🔥";
    const existing = await prisma.postReaction.findUnique({
      where: { postId_userId_emoji: { postId: id, userId: request.user!.id, emoji } },
    });
    let myFire: boolean;
    if (existing) {
      await prisma.postReaction.delete({ where: { id: existing.id } });
      myFire = false;
    } else {
      await prisma.postReaction.create({ data: { postId: id, userId: request.user!.id, emoji } });
      myFire = true;
    }
    const fire = await prisma.postReaction.count({ where: { postId: id } });
    return reply.send({ fire, myFire });
  });
}
