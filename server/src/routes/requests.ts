import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/session.js";
import { publicUser } from "../lib/serialize.js";

// Aggregates every actionable request type for the "Запити" tab.
export default async function requestsRoutes(app: FastifyInstance) {
  app.get("/requests", { preHandler: requireAuth }, async (request) => {
    const me = request.user!.id;

    const [joinRows, friendRows, inviteRows] = await Promise.all([
      prisma.joinRequest.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        select: { id: true, applicantNickname: true, bio: true, motivation: true, githubUrl: true, createdAt: true, passwordHash: true },
      }),
      prisma.friendship.findMany({
        where: { status: "pending", requestedById: { not: me }, OR: [{ userAId: me }, { userBId: me }] },
      }),
      prisma.communityInvite.findMany({
        where: { invitedUserId: me, status: "pending" },
        include: { community: { select: { slug: true, title: true } }, invitedBy: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } },
      }),
    ]);

    const requesterIds = friendRows.map((f) => (f.userAId === me ? f.userBId : f.userAId));
    const requesters = await prisma.user.findMany({
      where: { id: { in: requesterIds } },
      select: { id: true, nickname: true, avatarUrl: true, bio: true },
    });
    const byId = new Map(requesters.map((u) => [u.id, u]));

    return {
      joinRequests: joinRows.map((r) => ({
        id: r.id,
        nickname: r.applicantNickname,
        bio: r.bio,
        motivation: r.motivation,
        githubUrl: r.githubUrl,
        createdAt: r.createdAt.toISOString(),
        hasPassword: !!r.passwordHash,
      })),
      friendRequests: friendRows
        .map((f) => {
          const other = byId.get(f.userAId === me ? f.userBId : f.userAId);
          return other ? { friendshipId: f.id, user: publicUser(other) } : null;
        })
        .filter(Boolean),
      communityInvites: inviteRows.map((i) => ({
        id: i.id,
        community: { slug: i.community.slug, title: i.community.title },
        invitedBy: publicUser(i.invitedBy),
        createdAt: i.createdAt.toISOString(),
      })),
    };
  });

  app.post("/community-invites/:id/accept", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const inv = await prisma.communityInvite.findUnique({ where: { id } });
    if (!inv || inv.invitedUserId !== request.user!.id) return reply.code(404).send({ error: "not found" });
    await prisma.communityMember
      .create({ data: { communityId: inv.communityId, userId: request.user!.id, role: "member" } })
      .catch(() => {}); // ignore if already a member
    await prisma.communityInvite.update({ where: { id }, data: { status: "accepted" } });
    return reply.send({ ok: true });
  });

  app.post("/community-invites/:id/reject", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const inv = await prisma.communityInvite.findUnique({ where: { id } });
    if (!inv || inv.invitedUserId !== request.user!.id) return reply.code(404).send({ error: "not found" });
    await prisma.communityInvite.update({ where: { id }, data: { status: "rejected" } });
    return reply.send({ ok: true });
  });
}
