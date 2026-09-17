import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { cleanHtml } from "../lib/sanitize.js";
import { requireAuth } from "../lib/session.js";
import { commentInclude, serializeComment } from "../lib/serialize.js";
import { checkAchievements } from "../lib/achievements.js";

const bodySchema = z.object({
  bodyHtml: z.string().min(1).max(5000),
  parentCommentId: z.string().optional().nullable(),
});

export default async function commentRoutes(app: FastifyInstance) {
  app.post("/posts/:id/comments", { preHandler: requireAuth }, async (request, reply) => {
    const postId = (request.params as { id: string }).id;
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return reply.code(404).send({ error: "not found" });

    const c = await prisma.comment.create({
      data: {
        postId,
        parentCommentId: parsed.data.parentCommentId ?? null,
        authorId: request.user!.id,
        bodyHtml: cleanHtml(parsed.data.bodyHtml),
      },
      include: commentInclude,
    });
    await checkAchievements(request.user!.id, "comment");
    return reply.send({ comment: serializeComment(c as never) });
  });

  app.post("/threads/:id/comments", { preHandler: requireAuth }, async (request, reply) => {
    const threadId = (request.params as { id: string }).id;
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const thread = await prisma.thread.findUnique({ where: { id: threadId }, select: { id: true } });
    if (!thread) return reply.code(404).send({ error: "not found" });

    const c = await prisma.comment.create({
      data: {
        threadId,
        parentCommentId: parsed.data.parentCommentId ?? null,
        authorId: request.user!.id,
        bodyHtml: cleanHtml(parsed.data.bodyHtml),
      },
      include: commentInclude,
    });
    await checkAchievements(request.user!.id, "comment");
    return reply.send({ comment: serializeComment(c as never) });
  });

  // Upvote a comment (idempotent per user via a Redis set).
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
