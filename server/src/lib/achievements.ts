import { prisma } from "./prisma.js";

// Starter achievement set (plan §10). Seeded in prisma/seed.ts by `code`.
export const ACHIEVEMENTS = [
  { code: "first_post", title: "Перший пост", icon: "star", conditionDescription: "1-й опублікований пост" },
  { code: "five_agents", title: "П'ять агентів", icon: "flask", conditionDescription: "5 карток у розділі Агенти" },
  { code: "active_member", title: "Активний учасник", icon: "bolt", conditionDescription: "10+ коментарів за 30 днів" },
  { code: "hot_thread", title: "Автор популярної теми", icon: "fire", conditionDescription: "Тред з 10+ коментарями" },
] as const;

async function grant(userId: string, code: string) {
  const ach = await prisma.achievement.findUnique({ where: { code } });
  if (!ach) return;
  await prisma.userAchievement
    .create({ data: { userId, achievementId: ach.id } })
    .catch(() => {}); // ignore duplicate (unique constraint)
}

/** Hourly batch: award time/aggregate-based achievements that can't be checked
 *  on a single action (hot threads, sustained activity). */
export async function runPeriodicAchievements(): Promise<void> {
  try {
    const threads = await prisma.thread.findMany({
      select: { authorId: true, _count: { select: { comments: true } } },
    });
    for (const t of threads) if (t._count.comments >= 10) await grant(t.authorId, "hot_thread");

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const grouped = await prisma.comment.groupBy({ by: ["authorId"], where: { createdAt: { gte: since } }, _count: { _all: true } });
    for (const g of grouped) if (g._count._all >= 10) await grant(g.authorId, "active_member");
  } catch (e) {
    console.error("[achievements] periodic failed", e);
  }
}

/** Evaluate achievement triggers after a relevant action. Cheap at this scale. */
export async function checkAchievements(
  userId: string,
  event: "post" | "agent" | "comment",
): Promise<void> {
  try {
    if (event === "post") {
      const count = await prisma.post.count({ where: { authorId: userId } });
      if (count >= 1) await grant(userId, "first_post");
    }
    if (event === "agent") {
      const count = await prisma.agent.count({ where: { userId } });
      if (count >= 5) await grant(userId, "five_agents");
    }
    if (event === "comment") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const count = await prisma.comment.count({ where: { authorId: userId, createdAt: { gte: since } } });
      if (count >= 10) await grant(userId, "active_member");
    }
  } catch (e) {
    console.error("[achievements] check failed", e);
  }
}
