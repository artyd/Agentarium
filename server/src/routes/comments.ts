import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { cleanHtml } from "../lib/sanitize.js";
import { requireAuth } from "../lib/session.js";
import { commentInclude, serializeComment } from "../lib/serialize.js";
import { checkAchievements } from "../lib/achievements.js";
import { resolveMentions } from "../lib/mentions.js";
import { notify } from "../lib/notify.js";

const bodySchema = z.object({
  bodyHtml: z.string().min(1).max(5000),
  parentCommentId: z.string().optional().nullable(),
});

const snippet = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const strict = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };

async function notifyMentions(userIds: { id: string }[], me: string, opts: { postId?: string; commentId?: string }) {
  for (const u of userIds) if (u.id !== me) await notify({ userId: u.id, actorId: me, type: "mention", ...opts });
}

export default async function commentRoutes(app: FastifyInstance) {
  app.post("/posts/:id/comments", { preHandler: requireAuth, ...strict }, async (request, reply) => {
    const postId = (request.params as { id: string }).id;
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) return reply.code(404).send({ error: "not found" });
    const me = request.user!.id;

    const { html, userIds } = await resolveMentions(cleanHtml(parsed.data.bodyHtml));
    const c = await prisma.comment.create({
      data: { postId, parentCommentId: parsed.data.parentCommentId ?? null, authorId: me, bodyHtml: html },
      include: commentInclude,
    });
    await checkAchievements(me, "comment");

    if (parsed.data.parentCommentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentCommentId }, select: { authorId: true } });
      if (parent) await notify({ userId: parent.authorId, actorId: me, type: "reply", postId, commentId: c.id, text: snippet(html) });
    } else {
      await notify({ userId: post.authorId, actorId: me, type: "comment", postId, commentId: c.id, text: snippet(html) });
    }
    await notifyMentions(userIds, me, { postId, commentId: c.id });
    return reply.send({ comment: serializeComment(c as never) });
  });

  app.post("/threads/:id/comments", { preHandler: requireAuth, ...strict }, async (request, reply) => {
    const threadId = (request.params as { id: string }).id;
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const thread = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true, authorId: true } });
    if (!thread) return reply.code(404).send({ error: "not found" });
    const me = request.user!.id;

    const { html, userIds } = await resolveMentions(cleanHtml(parsed.data.bodyHtml));
    const c = await prisma.comment.create({
      data: { threadId, parentCommentId: parsed.data.parentCommentId ?? null, authorId: me, bodyHtml: html },
      include: commentInclude,
    });
    await checkAchievements(me, "comment");
    await notify({ userId: thread.authorId, actorId: me, type: "comment", commentId: c.id, text: snippet(html) });
    await notifyMentions(userIds, me, { commentId: c.id });
    return reply.send({ comment: serializeComment(c as never) });
  });

  app.put("/comments/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const parsed = z.object({ bodyHtml: z.string().min(1).max(5000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const c = await prisma.comment.findUnique({ where: { id }, select: { authorId: true } });
    if (!c) return reply.code(404).send({ error: "not found" });
    if (c.authorId !== request.user!.id) return reply.code(403).send({ error: "forbidden" });
    const { html } = await resolveMentions(cleanHtml(parsed.data.bodyHtml));
    const updated = await prisma.comment.update({ where: { id }, data: { bodyHtml: html, editedAt: new Date() }, include: commentInclude });
    return reply.send({ comment: serializeComment(updated as never) });
  });

  app.delete("/comments/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const c = await prisma.comment.findUnique({ where: { id }, select: { authorId: true } });
    if (!c) return reply.code(404).send({ error: "not found" });
    if (c.authorId !== request.user!.id) return reply.code(403).send({ error: "forbidden" });
    await prisma.comment.deleteMany({ where: { parentCommentId: id } });
    await prisma.comment.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  app.post("/comments/:id/vote", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const added = await redis.sAdd(`cvote:${id}`, request.user!.id);
    if (added === 1) {
      const c = await prisma.comment.update({ where: { id }, data: { score: { increment: 1 } } });
      return reply.send({ score: c.score });
    }
    const c = await prisma.comment.findUnique({ where: { id }, select: { score: true } });
    return reply.send({ score: c?.score ?? 0 });
  });
}
