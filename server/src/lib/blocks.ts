import { prisma } from "./prisma.js";

/** Set of user ids to hide from `userId` — anyone they blocked, or who blocked them. */
export async function blockedIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const set = new Set<string>();
  for (const r of rows) set.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  return set;
}
