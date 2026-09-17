import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { requireAuth } from "../lib/session.js";

const UPLOAD_DIR = path.resolve("uploads");
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export default async function uploadRoutes(app: FastifyInstance) {
  app.post("/uploads", { preHandler: requireAuth }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "no file" });
    if (!ALLOWED.has(file.mimetype)) return reply.code(415).send({ error: "unsupported type" });
    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${randomBytes(12).toString("hex")}${EXT[file.mimetype]}`;
    const dest = path.join(UPLOAD_DIR, name);
    await pipeline(file.file, createWriteStream(dest));
    if (file.file.truncated) return reply.code(413).send({ error: "file too large" });
    return reply.send({ url: `/uploads/${name}` });
  });
}
