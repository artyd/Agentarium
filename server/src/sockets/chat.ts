import type { Server, Socket } from "socket.io";
import type { FastifyInstance } from "fastify";
import * as cookie from "cookie";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { publicUser } from "../lib/serialize.js";
import { cleanHtml } from "../lib/sanitize.js";

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
        const body = cleanHtml(String(payload?.body ?? "")).slice(0, 8000);
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
        for (const o of others) io.to(`user:${o.userId}`).emit("chat:unread", { chatId });
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
