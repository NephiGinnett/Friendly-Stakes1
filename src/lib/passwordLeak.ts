import { prisma } from "@/lib/db";
import { ACHIEVEMENTS } from "@/lib/achievements";

// Achievement IDs that can appear in the leak pool
// Excludes passive/meta achievements that no one may have yet
const LEAK_POOL = Object.keys(ACHIEVEMENTS) as (keyof typeof ACHIEVEMENTS)[];

export async function refreshPasswordLeak(): Promise<string | null> {
  // Pick a random achievement that at least one non-admin player has unlocked
  const candidates = await prisma.userAchievement.groupBy({
    by: ["achievementId"],
    where: {
      user: { isAdmin: false },
    },
    _count: { userId: true },
    having: { userId: { _count: { gte: 1 } } },
  });

  const eligible = candidates
    .map((c) => c.achievementId)
    .filter((id) => LEAK_POOL.includes(id as keyof typeof ACHIEVEMENTS));

  if (eligible.length === 0) return null;

  const chosen = eligible[Math.floor(Math.random() * eligible.length)];

  await prisma.houseConfig.upsert({
    where: { id: 1 },
    create: { id: 1, leakAchievementId: chosen, leakRefreshedAt: new Date(), strikesSinceLeak: 0 },
    update: { leakAchievementId: chosen, leakRefreshedAt: new Date(), strikesSinceLeak: 0 },
  });

  return chosen;
}
