import { prisma } from "@/lib/db";
import { houseAttackFlavor } from "@/lib/house";
import { logPoints } from "@/lib/pointLog";

/** Returns a random next-strike time 2–6 hours from now. */
export function nextStrikeTime(): Date {
  const intervalMs = (2 + Math.random() * 4) * 60 * 60 * 1000;
  return new Date(Date.now() + intervalMs);
}

/** Returns true if current server-local hour is within the 6am–8pm window. */
export function isStrikeWindow(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20;
}

/** UTC date string for today, e.g. "2026-05-12" */
export function todayUtcDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** UTC date string for tomorrow */
export function tomorrowUtcDate(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Wake chance (0–80%) based on cumulative HP dealt this sleep window.
 * Starts at 5% after the first hit; +3% per additional 10 HP; caps at 80%.
 */
export function wakeChance(nightDamageHp: number): number {
  if (nightDamageHp <= 0) return 0;
  return Math.min(5 + Math.floor(nightDamageHp / 10) * 3, 80);
}

/** HP dealt since the current sleep window started (8pm last day or midnight if unknown). */
export async function nightDamageDealt(): Promise<number> {
  // Sleep window started at 8pm server-local time today (or yesterday if it's past midnight)
  const now = new Date();
  const sleepStart = new Date(now);
  sleepStart.setHours(20, 0, 0, 0);
  if (now < sleepStart) {
    // Before 8pm today — sleep window started yesterday at 8pm
    sleepStart.setDate(sleepStart.getDate() - 1);
  }

  const agg = await prisma.houseDamageLog.aggregate({
    where: { createdAt: { gte: sleepStart } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** Strike a specific user — erases their last positive log entry. */
export async function executeTargetedStrike(userId: number) {
  const lastPositive = await prisma.pointLog.findFirst({
    where: { userId, amount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });
  if (!lastPositive) return null;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (!targetUser) return null;

  const amount = lastPositive.amount;
  const flavor = `The House stirs. ${targetUser.username} disturbed its sleep — "${lastPositive.reason}" is erased. ${amount} pts reclaimed. Privileges suspended until morning.`;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { points: { decrement: amount } } });
    await tx.houseAttackLog.create({ data: { userId, amount, flavorText: flavor } });
    await logPoints(tx, userId, -amount, `The House woke: erased "${lastPositive.reason}"`);
  });

  // War Criminal check
  const totalAttacks = await prisma.houseAttackLog.count({ where: { userId } });
  if (totalAttacks >= 3) {
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: "war_criminal" } },
      create: { userId, achievementId: "war_criminal" },
      update: {},
    });
  }

  return { username: targetUser.username, amount, flavorText: flavor };
}

/**
 * Executes one House strike against a random non-admin player.
 * Erases their most recent positive PointLog entry.
 */
export async function executeHouseStrike() {
  const players = await prisma.user.findMany({
    where: { isAdmin: false },
    select: { id: true },
  });
  if (players.length === 0) return null;

  const shuffled = players.sort(() => Math.random() - 0.5);
  for (const { id } of shuffled) {
    const result = await executeTargetedStrike(id);
    if (result) return result;
  }

  return null;
}
