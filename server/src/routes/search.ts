import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { postInclude, serializePost, publicUser } from "../lib/serialize.js";

export default async function searchRoutes(app: FastifyInstance) {
  // One query → three grouped result blocks (people / posts / communities).
  app.get("/search", async (request) => {
    const q = String((request.query as { q?: string }).q ?? "").trim();
    if (q.length < 1) return { people: [], posts: [], communities: [] };
    const like = `%${q}%`;

    // People + communities: ILIKE over short text fields (case-insensitive).
    const [people, communities, postIds] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ nickname: { contains: q, mode: "insensitive" } }, { bio: { contains: q, mode: "insensitive" } }] },
        select: { id: true, nickname: true, avatarUrl: true, bio: true },
        take: 20,
      }),
      prisma.community.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { _count: { select: { members: true, threads: true } } },
        take: 20,
      }),
      // Posts: Postgres full-text over title + body (GIN-accelerated via migration).
      prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Post"
        WHERE to_tsvector('simple', coalesce(title,'') || ' ' || coalesce("bodyHtml",'')) @@ websearch_to_tsquery('simple', ${q})
           OR title ILIKE ${like}
        ORDER BY "createdAt" DESC
        LIMIT 20`,
    ]);

    const posts = postIds.length
      ? await prisma.post.findMany({ where: { id: { in: postIds.map((r) => r.id) } }, include: postInclude })
      : [];

    return {
      people: people.map(publicUser),
      communities: communities.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        memberCount: c._count.members,
        threadCount: c._count.threads,
      })),
      posts: posts.map((p) => serializePost(p as never, request.user?.id ?? null)),
    };
  });
}
