import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/session.js";
import { publicUser } from "../lib/serialize.js";
import { notify } from "../lib/notify.js";
import { onlineSet } from "../lib/presence.js";

function pairKey(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

export default async function friendRoutes(app: FastifyInstance) {
  // Directory of all members with my friendship status toward each.
  app.get("/people", { preHandler: requireAuth }, async (request) => {
    const me = request.user!.id;
    const users = await prisma.user.findMany({
      where: { id: { not: me } },
      select: { id: true, nickname: true, avatarUrl: true, bio: true },
      orderBy: { nickname: "asc" },
    });
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
    });
    const online = await onlineSet();
    const statusFor = (uid: string) => {
      const f = friendships.find(
        (x) => (x.userAId === uid || x.userBId === uid),
      );
      if (!f) return { status: "none" as const, friendshipId: null as string | null, incoming: false };
      return {
        status: f.status as "pending" | "accepted",
        friendshipId: f.id,
        incoming: f.status === "pending" && f.requestedById !== me,
      };
    };
    return {
      people: users.map((u) => ({ ...publicUser(u), ...statusFor(u.id), online: online.has(u.id) })),
    };
  });

  app.get("/friends", { preHandler: requireAuth }, async (request) => {
    const me = request.user!.id;
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
    });
    const otherIds = rows.map((f) => (f.userAId === me ? f.userBId : f.userAId));
    const users = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: { id: true, nickname: true, avatarUrl: true, bio: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const friends: unknown[] = [];
    const incoming: unknown[] = [];
    const outgoing: unknown[] = [];
    for (const f of rows) {
      const otherId = f.userAId === me ? f.userBId : f.userAId;
      const u = byId.get(otherId);
      if (!u) continue;
      const entry = { friendshipId: f.id, user: publicUser(u) };
      if (f.status === "accepted") friends.push(entry);
      else if (f.requestedById === me) outgoing.push(entry);
      else incoming.push(entry);
    }
    return { friends, incoming, outgoing };
  });

  app.post("/friends/request", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const parsed = z.object({ userId: z.string() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    if (parsed.data.userId === me) return reply.code(400).send({ error: "cannot friend self" });
    const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
    if (!target) return reply.code(404).send({ error: "not found" });

    const key = pairKey(me, parsed.data.userId);
    const existing = await prisma.friendship.findUnique({ where: { userAId_userBId: key } });
    if (existing) return reply.code(409).send({ error: "already exists", status: existing.status });

    const f = await prisma.friendship.create({
      data: { ...key, requestedById: me, status: "pending" },
    });
    await notify({ userId: parsed.data.userId, actorId: me, type: "friend_request" });
    return reply.send({ friendshipId: f.id, status: "pending" });
  });

  app.post("/friends/:id/accept", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const id = (request.params as { id: string }).id;
    const f = await prisma.friendship.findUnique({ where: { id } });
    if (!f || (f.userAId !== me && f.userBId !== me)) return reply.code(404).send({ error: "not found" });
    if (f.requestedById === me) return reply.code(400).send({ error: "cannot accept own request" });
    await prisma.friendship.update({ where: { id }, data: { status: "accepted" } });
    await notify({ userId: f.requestedById, actorId: me, type: "friend_accept" });
    return reply.send({ ok: true });
  });

  app.post("/friends/:id/reject", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const id = (request.params as { id: string }).id;
    const f = await prisma.friendship.findUnique({ where: { id } });
    if (!f || (f.userAId !== me && f.userBId !== me)) return reply.code(404).send({ error: "not found" });
    await prisma.friendship.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}
