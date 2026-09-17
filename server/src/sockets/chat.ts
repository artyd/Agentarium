import type { Server, Socket } from "socket.io";
import type { FastifyInstance } from "fastify";
import * as cookie from "cookie";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { publicUser } from "../lib/serialize.js";
import { cleanHtml } from "../lib/sanitize.js";
import { resolveMentions } from "../lib/mentions.js";
import { notify } from "../lib/notify.js";
import { emitAll } from "../lib/realtime.js";

type SocketUser = { id: string; nickname: string };

async function authenticate(app: FastifyInstance, socket: Socket): Promise<SocketUser | null> {
  const header = socket.handshake.headers.cookie;
  if (!header) return null;
  const raw = cookie.parse(header)["ag_sid"];
  if (!raw) return null;
  const unsigned = app.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;
  const sessRaw = await redis.get(`sess:${unsigned.value}`);
  if (!sessRaw) return null;
  const { userId } = JSON.parse(sessRaw) as { userId: string };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, nickname: true } });
  return user;
}

export function setupChatSockets(io: Server, app: FastifyInstance) {
  io.use(async (socket, next) => {
    const user = await authenticate(app, socket);
    if (!user) return next(new Error("unauthorized"));
    (socket.data as { user: SocketUser }).user = user;
    next();
  });

  io.on("connection", async (socket) => {
    const user = (socket.data as { user: SocketUser }).user;
    // Join a personal room + all of the user's chat rooms.
    socket.join(`user:${user.id}`);

    // Presence: reference-count connections; first in / last out toggles online.
    const count = await redis.incr(`pc:${user.id}`);
    if (count === 1) {
      await redis.sAdd("online", user.id);
      emitAll("presence", { userId: user.id, online: true });
    }
    socket.on("disconnect", async () => {
      const left = await redis.decr(`pc:${user.id}`);
      if (left <= 0) {
        await redis.del(`pc:${user.id}`);
        await redis.sRem("online", user.id);
        emitAll("presence", { userId: user.id, online: false });
      }
    });
    const memberships = await prisma.chatMember.findMany({
      where: { userId: user.id },
      select: { chatId: true },
    });
    for (const m of memberships) socket.join(`chat:${m.chatId}`);

    socket.on("chat:join", (chatId: string) => {
      if (typeof chatId === "string") socket.join(`chat:${chatId}`);
    });

    socket.on("chat:message", async (payload: { chatId?: string; body?: string }, ack?: (r: unknown) => void) => {
      try {
        const chatId = String(payload?.chatId ?? "");
        const clean = cleanHtml(String(payload?.body ?? "")).slice(0, 8000);
        const { html: body, userIds: mentioned } = await resolveMentions(clean);
        const plain = body.replace(/<[^>]*>/g, "").trim();
        if (!chatId || !plain) return ack?.({ error: "invalid" });
        const member = await prisma.chatMember.findUnique({
          where: { chatId_userId: { chatId, userId: user.id } },
        });
        if (!member) return ack?.({ error: "forbidden" });

        const msg = await prisma.message.create({
          data: { chatId, authorId: user.id, body },
          include: { author: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } },
        });
        const dto = {
          id: msg.id,
          chatId,
          body: msg.body,
          author: publicUser(msg.author),
          authorId: msg.authorId,
          createdAt: msg.createdAt.toISOString(),
        };
        io.to(`chat:${chatId}`).emit("chat:message", dto);
        // Nudge other members to refresh unread badges.
        const others = await prisma.chatMember.findMany({
          where: { chatId, userId: { not: user.id } },
          select: { userId: true },
        });
        const otherIds = new Set(others.map((o) => o.userId));
        for (const o of others) io.to(`user:${o.userId}`).emit("chat:unread", { chatId });
        for (const u of mentioned) if (u.id !== user.id && otherIds.has(u.id)) await notify({ userId: u.id, actorId: user.id, type: "mention", chatId });
        ack?.({ ok: true, message: dto });
      } catch (e) {
        console.error("[socket] chat:message failed", e);
        ack?.({ error: "server error" });
      }
    });

    socket.on("chat:typing", (payload: { chatId?: string }) => {
      const chatId = String(payload?.chatId ?? "");
      if (chatId) socket.to(`chat:${chatId}`).emit("chat:typing", { chatId, user });
    });

    socket.on("chat:edit", async (payload: { messageId?: string; body?: string }, ack?: (r: unknown) => void) => {
      const messageId = String(payload?.messageId ?? "");
      const body = cleanHtml(String(payload?.body ?? "")).slice(0, 8000);
      if (!messageId || !body.replace(/<[^>]*>/g, "").trim()) return ack?.({ error: "invalid" });
      const m = await prisma.message.findUnique({ where: { id: messageId } });
      if (!m || m.authorId !== user.id) return ack?.({ error: "forbidden" });
      await prisma.message.update({ where: { id: messageId }, data: { body } });
      io.to(`chat:${m.chatId}`).emit("chat:message:edit", { id: messageId, chatId: m.chatId, body });
      ack?.({ ok: true });
    });

    socket.on("chat:delete", async (payload: { messageId?: string }, ack?: (r: unknown) => void) => {
      const messageId = String(payload?.messageId ?? "");
      if (!messageId) return ack?.({ error: "invalid" });
      const m = await prisma.message.findUnique({ where: { id: messageId } });
      if (!m || m.authorId !== user.id) return ack?.({ error: "forbidden" });
      await prisma.message.delete({ where: { id: messageId } });
      io.to(`chat:${m.chatId}`).emit("chat:message:delete", { id: messageId, chatId: m.chatId });
      ack?.({ ok: true });
    });

    socket.on("chat:read", async (payload: { chatId?: string }) => {
      const chatId = String(payload?.chatId ?? "");
      if (!chatId) return;
      await prisma.chatMember
        .update({ where: { chatId_userId: { chatId, userId: user.id } }, data: { lastReadAt: new Date() } })
        .catch(() => {});
      socket.to(`chat:${chatId}`).emit("chat:read", { chatId, userId: user.id });
    });
  });
}
