import path from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import { env } from "./lib/env.js";
import { connectRedis, pubClient, subClient } from "./lib/redis.js";
import sessionPlugin from "./lib/session.js";
import { setupChatSockets } from "./sockets/chat.js";

import authRoutes from "./routes/auth.js";
import joinRoutes from "./routes/join.js";
import postRoutes from "./routes/posts.js";
import commentRoutes from "./routes/comments.js";
import communityRoutes from "./routes/communities.js";
import friendRoutes from "./routes/friends.js";
import chatRoutes from "./routes/chats.js";
import profileRoutes from "./routes/profile.js";
import githubRoutes from "./routes/github.js";
import searchRoutes from "./routes/search.js";
import requestsRoutes from "./routes/requests.js";
import uploadRoutes from "./routes/uploads.js";
import notificationRoutes from "./routes/notifications.js";
import { setIO } from "./lib/realtime.js";
import { runPeriodicAchievements } from "./lib/achievements.js";

const WEB_DIST = path.resolve("..", "web", "dist");
const UPLOAD_DIR = path.resolve("uploads");

async function main() {
  await connectRedis();

  const app = Fastify({
    logger: { level: env.isProd ? "info" : "warn" },
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, { global: false, max: 300, timeWindow: "1 minute" });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err: { message: err.message, stack: err.stack }, url: req.url, method: req.method }, "request error");
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(status).send({ error: status >= 500 ? "server error" : err.message });
  });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(sessionPlugin);

  // ── API ──
  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(joinRoutes);
      await api.register(postRoutes);
      await api.register(commentRoutes);
      await api.register(communityRoutes);
      await api.register(friendRoutes);
      await api.register(chatRoutes);
      await api.register(profileRoutes);
      await api.register(githubRoutes);
      await api.register(searchRoutes);
      await api.register(requestsRoutes);
      await api.register(uploadRoutes);
      await api.register(notificationRoutes);
    },
    { prefix: "/api" },
  );

  // ── Uploaded files ──
  await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: "/uploads/", decorateReply: false });

  // ── Static SPA (production build) ──
  await app.register(fastifyStatic, { root: WEB_DIST, prefix: "/" });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api") && !request.url.startsWith("/socket.io")) {
      return reply.sendFile("index.html");
    }
    reply.code(404).send({ error: "not found" });
  });

  await app.ready();

  // ── Socket.IO on the same HTTP server, Redis pub/sub adapter ──
  const io = new SocketServer(app.server, {
    path: "/socket.io",
    cors: { origin: env.isProd ? env.PUBLIC_URL : true, credentials: true },
  });
  io.adapter(createAdapter(pubClient, subClient));
  setIO(io);
  setupChatSockets(io, app);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Agentarium listening on :${env.PORT}`);

  // Hourly batch for time/aggregate-based achievements.
  runPeriodicAchievements();
  setInterval(() => runPeriodicAchievements(), 60 * 60 * 1000);
}

process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

main().catch((e) => {
  console.error("Fatal startup error", e);
  process.exit(1);
});
