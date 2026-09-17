import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { requireAuth } from "../lib/session.js";

const UPLOAD_DIR = path.resolve("uploads");
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX = 1600; // longest side

export default async function uploadRoutes(app: FastifyInstance) {
  app.post(
    "/uploads",
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "no file" });
      if (!ALLOWED.has(file.mimetype)) return reply.code(415).send({ error: "unsupported type" });

      const input = await file.toBuffer();
      if (file.file.truncated) return reply.code(413).send({ error: "file too large" });
      await mkdir(UPLOAD_DIR, { recursive: true });

      try {
        // Animated GIFs: keep as-is (resizing frames is heavier); others: downscale + re-encode webp.
        if (file.mimetype === "image/gif") {
          const name = `${randomBytes(12).toString("hex")}.gif`;
          await writeFile(path.join(UPLOAD_DIR, name), input);
          return reply.send({ url: `/uploads/${name}` });
        }
        const name = `${randomBytes(12).toString("hex")}.webp`;
        const out = await sharp(input)
          .rotate()
          .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        await writeFile(path.join(UPLOAD_DIR, name), out);
        return reply.send({ url: `/uploads/${name}` });
      } catch {
        return reply.code(400).send({ error: "invalid image" });
      }
    },
  );
}
