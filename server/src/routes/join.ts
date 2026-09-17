import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { cleanText } from "../lib/sanitize.js";
import { requireAuth } from "../lib/session.js";

const applySchema = z.object({
  name: z.string().min(2).max(40),
  bio: z.string().max(400).optional().default(""),
  motivation: z.string().max(1000).optional().default(""),
  githubUrl: z.string().max(200).optional().default(""),
});

export default async function joinRoutes(app: FastifyInstance) {
  // Public onboarding "apply to join" form (no password — approver relays a temp one).
  app.post(
    "/join-requests",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = applySchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid input" });
      const { name, bio, motivation, githubUrl } = parsed.data;
      const nick = cleanText(name);

      const existingUser = await prisma.user.findUnique({ where: { nickname: nick } });
      if (existingUser) return reply.code(409).send({ error: "nickname taken" });

      await prisma.joinRequest.create({
        data: {
          applicantNickname: nick,
          bio: cleanText(bio),
          motivation: cleanText(motivation),
          githubUrl: cleanText(githubUrl),
        },
      });
      return reply.send({ sent: true });
    },
  );

  // Any authenticated member can list pending requests.
  app.get("/join-requests", { preHandler: requireAuth }, async () => {
    const items = await prisma.joinRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        applicantNickname: true,
        bio: true,
        motivation: true,
        githubUrl: true,
        createdAt: true,
        passwordHash: true,
      },
    });
    return {
      requests: items.map((r) => ({
        id: r.id,
        nickname: r.applicantNickname,
        bio: r.bio,
        motivation: r.motivation,
        githubUrl: r.githubUrl,
        createdAt: r.createdAt.toISOString(),
        hasPassword: !!r.passwordHash,
      })),
    };
  });

  // Approve → create the real User. If the request has no password (onboarding
  // path), generate a one-time temp password returned once to the approver.
  app.post("/join-requests/:id/approve", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const jr = await prisma.joinRequest.findUnique({ where: { id } });
    if (!jr || jr.status !== "pending") return reply.code(404).send({ error: "not found" });

    const exists = await prisma.user.findUnique({ where: { nickname: jr.applicantNickname } });
    if (exists) {
      await prisma.joinRequest.update({ where: { id }, data: { status: "approved", reviewedById: request.user!.id } });
      return reply.code(409).send({ error: "nickname already exists" });
    }

    let tempPassword: string | null = null;
    let passwordHash = jr.passwordHash;
    if (!passwordHash) {
      tempPassword = randomBytes(6).toString("base64url");
      passwordHash = await argon2.hash(tempPassword);
    }

    await prisma.$transaction([
      prisma.user.create({
        data: {
          nickname: jr.applicantNickname,
          passwordHash: passwordHash!,
          bio: jr.bio,
          githubUrl: jr.githubUrl,
        },
      }),
      prisma.joinRequest.update({
        where: { id },
        data: { status: "approved", reviewedById: request.user!.id },
      }),
    ]);

    return reply.send({ approved: true, tempPassword });
  });

  app.post("/join-requests/:id/reject", { preHandler: requireAuth }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const jr = await prisma.joinRequest.findUnique({ where: { id } });
    if (!jr || jr.status !== "pending") return reply.code(404).send({ error: "not found" });
    await prisma.joinRequest.update({
      where: { id },
      data: { status: "rejected", reviewedById: request.user!.id },
    });
    return reply.send({ rejected: true });
  });
}
