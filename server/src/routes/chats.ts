import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/session.js";
import { publicUser } from "../lib/serialize.js";
import { onlineSet } from "../lib/presence.js";

async function unreadCount(chatId: string, userId: string, lastReadAt: Date | null): Promise<number> {
  return prisma.message.count({
    where: {
      chatId,
      authorId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

export default async function chatRoutes(app: FastifyInstance) {
  app.get("/chats", { preHandler: requireAuth }, async (request) => {
    const me = request.user!.id;
    const memberships = await prisma.chatMember.findMany({
      where: { userId: me },
      include: {
        chat: {
          include: {
            members: { include: { user: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    const online = await onlineSet();
    const chats = await Promise.all(
      memberships.map(async (m) => {
        const others = m.chat.members.filter((cm) => cm.userId !== me).map((cm) => publicUser(cm.user));
        const last = m.chat.messages[0];
        const unread = await unreadCount(m.chatId, me, m.lastReadAt);
        return {
          id: m.chat.id,
          type: m.chat.type,
          title: m.chat.title ?? (others[0]?.nickname ?? "Chat"),
          members: m.chat.members.map((cm) => publicUser(cm.user)),
          others,
          online: others.some((o) => online.has(o.id)),
          lastMessage: last ? { body: last.body, createdAt: last.createdAt.toISOString(), authorId: last.authorId } : null,
          unread,
          updatedAt: (last?.createdAt ?? m.chat.createdAt).toISOString(),
        };
      }),
    );
    chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const totalUnread = chats.reduce((s, c) => s + c.unread, 0);
    return { chats, totalUnread };
  });

  app.post("/chats/direct", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const parsed = z.object({ userId: z.string() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const other = parsed.data.userId;
    if (other === me) return reply.code(400).send({ error: "cannot chat self" });

    // Find an existing direct chat containing exactly the two of us.
    const mine = await prisma.chatMember.findMany({
      where: { userId: me, chat: { type: "direct" } },
      select: { chatId: true },
    });
    const shared = await prisma.chatMember.findFirst({
      where: { userId: other, chatId: { in: mine.map((c) => c.chatId) } },
    });
    if (shared) return reply.send({ chatId: shared.chatId });

    const chat = await prisma.chat.create({
      data: { type: "direct", members: { create: [{ userId: me }, { userId: other }] } },
    });
    return reply.send({ chatId: chat.id });
  });

  app.post("/chats/group", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const parsed = z
      .object({ title: z.string().min(1).max(80), memberIds: z.array(z.string()).min(1), communityId: z.string().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const ids = Array.from(new Set([me, ...parsed.data.memberIds]));
    const chat = await prisma.chat.create({
      data: {
        type: "group",
        title: parsed.data.title,
        communityId: parsed.data.communityId ?? null,
        members: { create: ids.map((userId) => ({ userId })) },
      },
    });
    return reply.send({ chatId: chat.id });
  });

  app.get("/chats/:id/messages", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const chatId = (request.params as { id: string }).id;
    const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: me } } });
    if (!member) return reply.code(403).send({ error: "not a member" });

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { author: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } },
    });
    // Mark read.
    await prisma.chatMember.update({ where: { chatId_userId: { chatId, userId: me } }, data: { lastReadAt: new Date() } });

    return {
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        author: publicUser(m.author),
        mine: m.authorId === me,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

  app.post("/chats/:id/leave", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const chatId = (request.params as { id: string }).id;
    const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: me } } });
    if (!member) return reply.code(404).send({ error: "not a member" });
    await prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId: me } } });
    const remaining = await prisma.chatMember.count({ where: { chatId } });
    if (remaining === 0) await prisma.chat.delete({ where: { id: chatId } });
    return reply.send({ ok: true });
  });

  app.post("/chats/:id/read", { preHandler: requireAuth }, async (request, reply) => {
    const me = request.user!.id;
    const chatId = (request.params as { id: string }).id;
    await prisma.chatMember
      .update({ where: { chatId_userId: { chatId, userId: me } }, data: { lastReadAt: new Date() } })
      .catch(() => {});
    return reply.send({ ok: true });
  });
}
