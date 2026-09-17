// Plain-JS seed (runs with `node` in the production image — no tsx/dev deps needed).
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const ACHIEVEMENTS = [
  { code: "first_post", title: "Перший пост", icon: "star", conditionDescription: "1-й опублікований пост" },
  { code: "five_agents", title: "П'ять агентів", icon: "flask", conditionDescription: "5 карток у розділі Агенти" },
  { code: "active_member", title: "Активний учасник", icon: "bolt", conditionDescription: "10+ коментарів за 30 днів" },
  { code: "hot_thread", title: "Автор популярної теми", icon: "fire", conditionDescription: "Тред з 10+ коментарями" },
];

async function main() {
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { code: a.code }, update: a, create: a });
  }

  const nick = process.env.SEED_ADMIN_NICK;
  const pass = process.env.SEED_ADMIN_PASS;
  if (nick && pass) {
    const existing = await prisma.user.findUnique({ where: { nickname: nick } });
    if (!existing) {
      await prisma.user.create({
        data: { nickname: nick, passwordHash: await argon2.hash(pass), bio: "Founding member" },
      });
      console.log(`Seeded bootstrap member '${nick}'.`);
    } else {
      console.log(`Member '${nick}' already exists — skipping.`);
    }
  } else {
    console.log("SEED_ADMIN_NICK / SEED_ADMIN_PASS not set — skipping bootstrap member.");
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
