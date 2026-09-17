import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/session.js";
import { serializeNotification } from "../lib/notify.js";

export default async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: requireAuth }, async (request) => {
    const me = request.user!.id;
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: me },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } },
      }),
      prisma.notification.count({ where: { userId: me, read: false } }),
    ]);
    return { notifications: rows.map(serializeNotification), unread };
  });

  app.post("/notifications/read-all", { preHandler: requireAuth }, async (request) => {
    await prisma.notification.updateMany({ where: { userId: request.user!.id, read: false }, data: { read: true } });
    return { ok: true };
  });

  app.post("/notifications/:id/read", { preHandler: requireAuth }, async (request) => {
    const id = (request.params as { id: string }).id;
    await prisma.notification.updateMany({ where: { id, userId: request.user!.id }, data: { read: true } });
    return { ok: true };
  });
}
