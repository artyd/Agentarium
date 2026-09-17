import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/session.js";
import { cleanText } from "../lib/sanitize.js";
import { notify } from "../lib/notify.js";

export default async function socialRoutes(app: FastifyInstance) {
  app.post("/users/:nickname/follow", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const nickname = (request.params as { nickname: string }).nickname;
    const target = await prisma.user.findUnique({ where: { nickname }, select: { id: true } });
    if (!target) return reply.code(404).send({ error: "not found" });
    if (target.id === me) return reply.code(400).send({ error: "cannot follow self" });
    const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me, followingId: target.id } } });
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      return reply.send({ following: false });
    }
    await prisma.follow.create({ data: { followerId: me, followingId: target.id } }).catch(() => {});
    return reply.send({ following: true });
  });

  app.post("/users/:nickname/block", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const nickname = (request.params as { nickname: string }).nickname;
    const target = await prisma.user.findUnique({ where: { nickname }, select: { id: true } });
    if (!target) return reply.code(404).send({ error: "not found" });
    if (target.id === me) return reply.code(400).send({ error: "cannot block self" });
    const existing = await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: me, blockedId: target.id } } });
    if (existing) {
      await prisma.block.delete({ where: { id: existing.id } });
      return reply.send({ blocked: false });
    }
    await prisma.block.create({ data: { blockerId: me, blockedId: target.id } }).catch(() => {});
    // blocking removes any friendship and follows between the two
    const [a, b] = me < target.id ? [me, target.id] : [target.id, me];
    await prisma.friendship.deleteMany({ where: { userAId: a, userBId: b } });
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: me, followingId: target.id }, { followerId: target.id, followingId: me }] } });
    return reply.send({ blocked: true });
  });

  app.post("/reports", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        postId: z.string().optional().nullable(),
        commentId: z.string().optional().nullable(),
        targetNickname: z.string().optional().nullable(),
        reason: z.string().min(1).max(500),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const d = parsed.data;
    let targetUserId: string | null = null;
    if (d.targetNickname) {
      const u = await prisma.user.findUnique({ where: { nickname: d.targetNickname }, select: { id: true } });
      targetUserId = u?.id ?? null;
    }
    await prisma.report.create({
      data: {
        reporterId: request.user!.id,
        postId: d.postId ?? null,
        commentId: d.commentId ?? null,
        targetUserId,
        reason: cleanText(d.reason),
      },
    });
    return reply.send({ ok: true });
  });
}
