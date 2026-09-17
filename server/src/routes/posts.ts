import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cleanHtml, cleanText, cleanInline } from "../lib/sanitize.js";
import { requireAuth } from "../lib/session.js";
import { postInclude, serializePost, nestComments, commentInclude } from "../lib/serialize.js";
import { checkAchievements } from "../lib/achievements.js";
import { resolveMentions } from "../lib/mentions.js";
import { notify } from "../lib/notify.js";
import { emitAll } from "../lib/realtime.js";

const POST_TYPES = ["agent", "project", "article", "skill", "thought"] as const;

const createSchema = z.object({
  type: z.enum(POST_TYPES),
  title: z.string().min(1).max(2000),
  bodyHtml: z.string().max(20000).optional().default(""),
  codeSnippet: z.string().max(20000).optional().nullable(),
  linkUrl: z.string().url().max(500).optional().nullable(),
  linkTitle: z.string().max(200).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  communityId: z.string().optional().nullable(),
});

const TAG_RE = /#([\p{L}\p{N}_]{2,30})/gu;
function extractTags(...parts: string[]): string[] {
  const text = parts.join(" ").replace(/<[^>]*>/g, " ");
  const set = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) set.add(m[1].toLowerCase());
  return [...set].slice(0, 10);
}

const REDDIT_EPOCH = 1_134_028_003;
function hotScore(engagement: number, createdAt: string): number {
  const order = Math.log10(Math.max(Math.abs(engagement), 1));
  const sign = engagement > 0 ? 1 : engagement < 0 ? -1 : 0;
  const seconds = new Date(createdAt).getTime() / 1000 - REDDIT_EPOCH;
  return sign * order + seconds / 45_000;
}

const strict = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

export default async function postRoutes(app: FastifyInstance) {
  app.get("/posts", async (request) => {
    const q = request.query as { sort?: string; type?: string; community?: string; author?: string; scope?: string; tag?: string };
    const me = request.user?.id ?? null;
    const where: Record<string, unknown> = {};
    if (q.type && POST_TYPES.includes(q.type as (typeof POST_TYPES)[number])) where.type = q.type;
    if (q.community) where.community = { slug: q.community };
    if (q.author) where.author = { nickname: q.author };
    if (q.tag) where.tags = { has: q.tag.toLowerCase() };

    if (me && q.scope === "friends") {
      const fr = await prisma.friendship.findMany({ where: { status: "accepted", OR: [{ userAId: me }, { userBId: me }] } });
      const ids = fr.map((f) => (f.userAId === me ? f.userBId : f.userAId));
      where.authorId = { in: ids.length ? ids : ["__none__"] };
    } else if (me && q.scope === "communities") {
      const mem = await prisma.communityMember.findMany({ where: { userId: me }, select: { communityId: true } });
      where.communityId = { in: mem.map((m) => m.communityId).concat("__none__") };
    } else if (me && q.scope === "saved") {
      where.bookmarks = { some: { userId: me } };
    }

    const rows = await prisma.post.findMany({ where, include: postInclude, orderBy: { createdAt: "desc" }, take: 100 });
    let posts = rows.map((p) => serializePost(p as never, me));

    const sort = q.sort ?? "hot";
    if (sort === "new") posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === "top") posts.sort((a, b) => b.score + b.fire - (a.score + a.fire));
    else posts.sort((a, b) => hotScore(b.score + b.fire, b.createdAt) - hotScore(a.score + a.fire, a.createdAt));
    // Pinned posts float to the top within a community view.
    if (q.community) posts.sort((a, b) => Number(b.pinned) - Number(a.pinned));

    return { posts };
  });

  app.get("/posts/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const p = await prisma.post.findUnique({ where: { id }, include: postInclude });
    if (!p) return reply.code(404).send({ error: "not found" });
    const comments = await prisma.comment.findMany({ where: { postId: id }, include: commentInclude, orderBy: { createdAt: "asc" } });
    return { post: serializePost(p as never, request.user?.id ?? null), comments: nestComments(comments as never) };
  });

  app.post("/posts", { preHandler: requireAuth, ...strict }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const d = parsed.data;
    const me = request.user!.id;

    if (d.communityId) {
      const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: d.communityId, userId: me } } });
      if (!member) return reply.code(403).send({ error: "not a community member" });
    }

    const title = cleanInline(d.title);
    const { html, userIds } = await resolveMentions(cleanHtml(d.bodyHtml ?? ""));
    const tags = extractTags(title, html);
    const post = await prisma.post.create({
      data: {
        authorId: me, type: d.type, title, bodyHtml: html,
        codeSnippet: d.codeSnippet ? cleanText(d.codeSnippet) : null,
        linkUrl: d.linkUrl ?? null, linkTitle: d.linkTitle ? cleanText(d.linkTitle) : null,
        imageUrl: d.imageUrl ?? null, communityId: d.communityId ?? null, tags,
      },
      include: postInclude,
    });
    await checkAchievements(me, "post");
    for (const u of userIds) if (u.id !== me) await notify({ userId: u.id, actorId: me, type: "mention", postId: post.id });
    emitAll("feed:new", { id: post.id });
    return reply.send({ post: serializePost(post as never, me) });
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
    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true, title: true, bodyHtml: true } });
    if (!post) return reply.code(404).send({ error: "not found" });
    if (post.authorId !== request.user!.id) return reply.code(403).send({ error: "forbidden" });
    const d = parsed.data;
    const data: Record<string, unknown> = {};
    let nextTitle = post.title;
    let nextBody = post.bodyHtml;
    if (d.title !== undefined) { nextTitle = cleanInline(d.title); data.title = nextTitle; }
    if (d.bodyHtml !== undefined) { nextBody = (await resolveMentions(cleanHtml(d.bodyHtml))).html; data.bodyHtml = nextBody; }
    if (d.title !== undefined || d.bodyHtml !== undefined) data.tags = extractTags(nextTitle, nextBody);
    if (d.codeSnippet !== undefined) data.codeSnippet = d.codeSnippet ? cleanText(d.codeSnippet) : null;
    if (d.linkUrl !== undefined) data.linkUrl = d.linkUrl;
    if (d.imageUrl !== undefined) data.imageUrl = d.imageUrl;
    const updated = await prisma.post.update({ where: { id }, data, include: postInclude });
    return reply.send({ post: serializePost(updated as never, request.user!.id) });
  });

  app.delete("/posts/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const me = request.user!.id;
    const p = await prisma.post.findUnique({ where: { id }, select: { authorId: true, communityId: true } });
    if (!p) return reply.code(404).send({ error: "not found" });
    let allowed = p.authorId === me;
    if (!allowed && p.communityId) {
      const c = await prisma.community.findUnique({ where: { id: p.communityId }, select: { ownerId: true } });
      allowed = c?.ownerId === me; // community owner may moderate
    }
    if (!allowed) return reply.code(403).send({ error: "forbidden" });
    await prisma.post.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // Pin/unpin within a community (owner only).
  app.post("/posts/:id/pin", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const p = await prisma.post.findUnique({ where: { id }, select: { pinned: true, communityId: true } });
    if (!p || !p.communityId) return reply.code(404).send({ error: "not found" });
    const c = await prisma.community.findUnique({ where: { id: p.communityId }, select: { ownerId: true } });
    if (c?.ownerId !== request.user!.id) return reply.code(403).send({ error: "forbidden" });
    const up = await prisma.post.update({ where: { id }, data: { pinned: !p.pinned } });
    return reply.send({ pinned: up.pinned });
  });

  app.post("/posts/:id/bookmark", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const me = request.user!.id;
    const existing = await prisma.bookmark.findUnique({ where: { userId_postId: { userId: me, postId: id } } });
    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return reply.send({ bookmarked: false });
    }
    await prisma.bookmark.create({ data: { userId: me, postId: id } }).catch(() => {});
    return reply.send({ bookmarked: true });
  });

  app.post("/posts/:id/vote", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const parsed = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const value = parsed.data.value;
    const me = request.user!.id;
    const key = { postId_userId: { postId: id, userId: me } };
    if (value === 0) {
      await prisma.postVote.deleteMany({ where: { postId: id, userId: me } });
    } else {
      await prisma.postVote.upsert({ where: key, create: { postId: id, userId: me, value }, update: { value } });
      if (value === 1) {
        const p = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
        if (p) await notify({ userId: p.authorId, actorId: me, type: "upvote", postId: id });
      }
    }
    const votes = await prisma.postVote.findMany({ where: { postId: id }, select: { value: true } });
    return reply.send({ score: votes.reduce((s, v) => s + v.value, 0), myVote: value });
  });

  app.post("/posts/:id/react", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const emoji = "🔥";
    const me = request.user!.id;
    const existing = await prisma.postReaction.findUnique({ where: { postId_userId_emoji: { postId: id, userId: me, emoji } } });
    let myFire: boolean;
    if (existing) {
      await prisma.postReaction.delete({ where: { id: existing.id } });
      myFire = false;
    } else {
      await prisma.postReaction.create({ data: { postId: id, userId: me, emoji } });
      myFire = true;
      const p = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
      if (p) await notify({ userId: p.authorId, actorId: me, type: "fire", postId: id });
    }
    const fire = await prisma.postReaction.count({ where: { postId: id } });
    return reply.send({ fire, myFire });
  });
}
