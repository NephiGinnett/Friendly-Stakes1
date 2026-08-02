import { prisma } from "@/lib/db";
import { ACHIEVEMENTS } from "@/lib/achievements";

// Achievement IDs that can appear in the leak pool
// Excludes passive/meta achievements that no one may have yet
const LEAK_POOL = Object.keys(ACHIEVEMENTS) as (keyof typeof ACHIEVEMENTS)[];

/**
 * Snapshots the passwords of everyone holding `achievementId` right now.
 *
 * The leak is deliberately a *dead* list. Once drawn it is never recomputed, so
 * a player who changes their password afterwards leaves a stale string behind
 * rather than silently republishing their new one — which is what makes the
 * Change Password shop item worth buying. Players who earn the achievement
 * after the draw are likewise not added. The read path serves only this
 * snapshot and never falls back to a live query.
 *
 * Usernames are never captured; only the password strings.
 */
export async function captureLeakPasswords(achievementId: string): Promise<string[]> {
  const holders = await prisma.userAchievement.findMany({
    where: { achievementId, user: { isAdmin: false } },
    include: { user: { select: { password: true } } },
  });
  return holders.map((h) => h.user.password).filter(Boolean);
}

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

  // Freeze the password list at draw time — see captureLeakPasswords.
  const snapshot = JSON.stringify(await captureLeakPasswords(chosen));

  await prisma.houseConfig.upsert({
    where: { id: 1 },
    create: { id: 1, leakAchievementId: chosen, leakRefreshedAt: new Date(), strikesSinceLeak: 0, leakPasswords: snapshot },
    update: { leakAchievementId: chosen, leakRefreshedAt: new Date(), strikesSinceLeak: 0, leakPasswords: snapshot },
  });

  return chosen;
}
