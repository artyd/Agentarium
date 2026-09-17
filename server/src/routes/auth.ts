import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cleanText } from "../lib/sanitize.js";
import { login, logout, requireAuth } from "../lib/session.js";

const strictLimit = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

const registerSchema = z.object({
  nickname: z.string().min(2).max(40),
  password: z.string().min(6).max(200),
  bio: z.string().max(400).optional().default(""),
});

const loginSchema = z.object({
  nickname: z.string().min(1),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  // Open registration — creates the account directly and logs the user in.
  app.post("/register", strictLimit, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const { nickname, password, bio } = parsed.data;
    const nick = cleanText(nickname);

    const existingUser = await prisma.user.findUnique({ where: { nickname: nick } });
    if (existingUser) return reply.code(409).send({ error: "nickname taken" });

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({ data: { nickname: nick, passwordHash, bio: cleanText(bio) } });
    await login(reply, user.id);
    return reply.send({ user: { id: user.id, nickname: user.nickname, bio: user.bio, avatarUrl: user.avatarUrl, locale: user.locale } });
  });

  app.post("/login", strictLimit, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const { nickname, password } = parsed.data;
    const nick = cleanText(nickname);

    const user = await prisma.user.findUnique({ where: { nickname: nick } });
    if (!user) {
      const pending = await prisma.joinRequest.findFirst({
        where: { applicantNickname: nick, status: "pending" },
      });
      if (pending) return reply.code(403).send({ error: "pending approval" });
      return reply.code(401).send({ error: "invalid credentials" });
    }
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) return reply.code(401).send({ error: "invalid credentials" });

    await login(reply, user.id);
    return reply.send({
      user: { id: user.id, nickname: user.nickname, bio: user.bio, avatarUrl: user.avatarUrl, locale: user.locale },
    });
  });

  app.post("/logout", async (request, reply) => {
    await logout(request, reply);
    return reply.send({ ok: true });
  });

  app.get("/me", async (request, reply) => {
    if (!request.user) return reply.send({ user: null });
    return reply.send({ user: request.user });
  });

  app.put("/me/locale", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ locale: z.enum(["ua", "en"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { locale: parsed.data.locale },
    });
    return reply.send({ ok: true });
  });

  app.put("/me/password", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({ oldPassword: z.string().min(1), newPassword: z.string().min(6).max(200) })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user) return reply.code(404).send({ error: "not found" });
    const ok = await argon2.verify(user.passwordHash, parsed.data.oldPassword).catch(() => false);
    if (!ok) return reply.code(403).send({ error: "wrong password" });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(parsed.data.newPassword) } });
    return reply.send({ ok: true });
  });

  app.delete("/me", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ password: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user) return reply.code(404).send({ error: "not found" });
    const ok = await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false);
    if (!ok) return reply.code(403).send({ error: "wrong password" });
    await prisma.user.delete({ where: { id: user.id } });
    await logout(request, reply);
    return reply.send({ ok: true });
  });
}
