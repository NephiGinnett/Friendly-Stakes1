import { prisma } from "@/lib/db";
import { logPoints } from "@/lib/pointLog";
import { notifyUser, appUrl } from "@/lib/discordNotify";
import { WAKE_NOISE_WHERE } from "@/lib/houseLog";

// Set HOUSE_UTC_OFFSET in .env to your event's UTC offset (e.g. -4 for EDT, -5 for EST)
const HOUSE_UTC_OFFSET = parseInt(process.env.HOUSE_UTC_OFFSET ?? "-4", 10);

/** Current hour in the event's local timezone (0–23). */
function localHouseHour(): number {
  const utcHour = new Date().getUTCHours();
  return ((utcHour + HOUSE_UTC_OFFSET) % 24 + 24) % 24;
}

/** Returns a random next-strike time 2–6 hours from now. */
export function nextStrikeTime(): Date {
  const intervalMs = (2 + Math.random() * 4) * 60 * 60 * 1000;
  return new Date(Date.now() + intervalMs);
}

/** Returns true if current local hour is within the 6am–8pm window. */
export function isStrikeWindow(): boolean {
  const hour = localHouseHour();
  return hour >= 6 && hour < 20;
}

/** UTC date string for today in the event's local timezone, e.g. "2026-05-12" */
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

/** HP dealt since the current sleep window started (8pm local time). */
export async function nightDamageDealt(): Promise<number> {
  // Shift "now" into local time by adding offset as ms
  const localMs = Date.now() + HOUSE_UTC_OFFSET * 3600_000;
  const localNow = new Date(localMs);

  // In the shifted representation, getUTCHours() == local hour
  const sleepStartLocal = new Date(localMs);
  sleepStartLocal.setUTCHours(20, 0, 0, 0);

  if (localNow.getUTCHours() < 20) {
    // Before 8pm local — sleep window started yesterday at 8pm local
    sleepStartLocal.setUTCDate(sleepStartLocal.getUTCDate() - 1);
  }

  // Convert shifted timestamp back to real UTC
  const sleepStartUTC = new Date(sleepStartLocal.getTime() - HOUSE_UTC_OFFSET * 3600_000);

  // Heals are excluded — feeding The House is not a disturbance, and counting
  // them would let a losing streak wake it on the loser's behalf.
  const agg = await prisma.houseDamageLog.aggregate({
    where: { createdAt: { gte: sleepStartUTC }, ...WAKE_NOISE_WHERE },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** Strike a specific user — erases their last positive log entry, or takes 50 pts if none exists. */
export async function executeTargetedStrike(userId: number) {
  const [lastPositive, targetUser] = await Promise.all([
    prisma.pointLog.findFirst({
      where: { userId, amount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, points: true },
    }),
  ]);

  if (!targetUser) return null;

  let amount: number;
  let flavor: string;
  let logReason: string;

  if (lastPositive) {
    amount = lastPositive.amount;
    flavor = `The House stirs. ${targetUser.username} disturbed its sleep — "${lastPositive.reason}" is erased. ${amount} pts reclaimed. Privileges suspended until morning.`;
    logReason = `The House woke: erased "${lastPositive.reason}"`;
  } else {
    // Fallback: no log entry to erase — levy a flat 50pt silence tax
    if ((targetUser.points ?? 0) < 50) return null;
    amount = 50;
    flavor = `The House stirs. ${targetUser.username}'s record was clean — silence costs 50 pts. Privileges suspended until morning.`;
    logReason = `The House woke: silence tax`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { points: { decrement: amount } } });
    await tx.houseAttackLog.create({ data: { userId, amount, flavorText: flavor } });
    await logPoints(tx, userId, -amount, logReason);
  });

  const totalAttacks = await prisma.houseAttackLog.count({ where: { userId } });
  if (totalAttacks >= 3) {
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: "war_criminal" } },
      create: { userId, achievementId: "war_criminal" },
      update: {},
    });
  }

  void notifyUser(userId, `🏚️ **THE HOUSE strikes!**\n${flavor}\n> -${amount} pts\n${appUrl("/house")}`);

  return { username: targetUser.username, amount, flavorText: flavor };
}

/**
 * Executes one House strike against a random non-admin player.
 * Players with the im_special achievement have 1/3 the targeting weight.
 */
export async function executeHouseStrike() {
  const players = await prisma.user.findMany({
    where: { isAdmin: false },
    select: { id: true },
  });
  if (players.length === 0) return null;

  const imSpecialHolders = new Set(
    (await prisma.userAchievement.findMany({
      where: { achievementId: "im_special" },
      select: { userId: true },
    })).map((r) => r.userId)
  );

  // Build weighted pool: regular players appear 3×, im_special holders appear 1×
  const pool: number[] = [];
  for (const { id } of players) {
    const weight = imSpecialHolders.has(id) ? 1 : 3;
    for (let i = 0; i < weight; i++) pool.push(id);
  }

  // Shuffle and try each unique candidate in order
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const tried = new Set<number>();
  for (const id of shuffled) {
    if (tried.has(id)) continue;
    tried.add(id);
    const result = await executeTargetedStrike(id);
    if (result) return result;
  }

  return null;
}
