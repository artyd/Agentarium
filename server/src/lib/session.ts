import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "./fp.js";
import { redis } from "./redis.js";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

const COOKIE = "ag_sid";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  nickname: string;
  bio: string | null;
  avatarUrl: string | null;
  locale: "ua" | "en";
};

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionId: string | null;
  }
}

async function createSession(userId: string): Promise<string> {
  const sid = randomBytes(24).toString("hex");
  await redis.set(`sess:${sid}`, JSON.stringify({ userId }), { EX: TTL_SECONDS });
  return sid;
}

async function readSession(sid: string): Promise<string | null> {
  const raw = await redis.get(`sess:${sid}`);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { userId: string }).userId;
  } catch {
    return null;
  }
}

export async function destroySession(sid: string): Promise<void> {
  await redis.del(`sess:${sid}`);
}

async function loadUser(userId: string): Promise<SessionUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nickname: true, bio: true, avatarUrl: true, locale: true },
  });
  return u ? { ...u, locale: u.locale as "ua" | "en" } : null;
}

/** Set the session cookie after a successful login/register-approval. */
export async function login(reply: FastifyReply, userId: string): Promise<void> {
  const sid = await createSession(userId);
  reply.setCookie(COOKIE, sid, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    signed: true,
    maxAge: TTL_SECONDS,
  });
}

export async function logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.sessionId) await destroySession(request.sessionId);
  reply.clearCookie(COOKIE, { path: "/" });
}

/** preHandler: reject unauthenticated requests. */
export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: (e?: Error) => void) {
  if (!request.user) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  done();
}

async function sessionPlugin(app: FastifyInstance) {
  // Populate request.user from the signed session cookie on every request.
  app.decorateRequest("user", null);
  app.decorateRequest("sessionId", null);

  app.addHook("onRequest", async (request) => {
    const raw = request.cookies[COOKIE];
    if (!raw) return;
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) return;
    const userId = await readSession(unsigned.value);
    if (!userId) return;
    const user = await loadUser(userId);
    if (user) {
      request.user = user;
      request.sessionId = unsigned.value;
    }
  });

  // CSRF defense: for mutating requests, require a same-origin Origin header.
  app.addHook("onRequest", async (request, reply) => {
    const method = request.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
    const origin = request.headers.origin;
    if (!origin) return; // non-browser / same-origin fetch without Origin is allowed
    const allowed = new Set<string>([env.PUBLIC_URL, "http://localhost:5173", "http://localhost:8016"]);
    try {
      const host = new URL(origin).host;
      const ok = [...allowed].some((a) => {
        try {
          return new URL(a).host === host;
        } catch {
          return false;
        }
      });
      if (!ok) {
        reply.code(403).send({ error: "bad origin" });
      }
    } catch {
      reply.code(403).send({ error: "bad origin" });
    }
  });
}

export default fp(sessionPlugin);
