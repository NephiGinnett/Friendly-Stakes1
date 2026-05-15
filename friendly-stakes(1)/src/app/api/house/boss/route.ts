import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { executeHouseStrike, nextStrikeTime, isStrikeWindow, nightDamageDealt, wakeChance } from "@/lib/houseStrike";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config) return NextResponse.json({ active: false, bossHp: 0, bossMaxHp: 0, defeated: false, sleeping: false });

  // Auto-strike: fire if boss is active, within window, and scheduled time has passed.
  // Uses updateMany with exact nextStrikeAt match to prevent concurrent double-strikes.
  if (config.bossActive && config.bossHp > 0 && config.nextStrikeAt && config.nextStrikeAt <= new Date() && isStrikeWindow()) {
    const claimed = await prisma.houseConfig.updateMany({
      where: { id: 1, nextStrikeAt: config.nextStrikeAt },
      data: { nextStrikeAt: nextStrikeTime() },
    });
    if (claimed.count > 0) {
      await executeHouseStrike();
      config = await prisma.houseConfig.findUnique({ where: { id: 1 } }) ?? config;
    }
  }

  const sleeping = !isStrikeWindow();
  const defeated = config.bossMaxHp > 0 && config.bossHp <= 0;

  const nightHp = sleeping ? await nightDamageDealt() : 0;
  const currentWakeChance = sleeping ? wakeChance(nightHp) : 0;

  const [damageLogs, attackLogs, myDamageAgg] = await Promise.all([
    prisma.houseDamageLog.findMany({
      where: { source: { not: "sleep_game" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { username: true } } },
    }),
    prisma.houseAttackLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { username: true } } },
    }),
    prisma.houseDamageLog.aggregate({ where: { userId: user.id, source: { not: "sleep_game" } }, _sum: { amount: true } }),
  ]);

  const killer = config.killerUserId
    ? await prisma.user.findUnique({ where: { id: config.killerUserId }, select: { username: true } })
    : null;

  const leaderboardRaw = await prisma.houseDamageLog.groupBy({
    by: ["userId"],
    where: { source: { not: "sleep_game" } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const userIds = leaderboardRaw.map(r => r.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } });
  const leaderboard = leaderboardRaw.map(r => ({
    username: users.find(u => u.id === r.userId)?.username ?? "?",
    totalDamage: r._sum.amount ?? 0,
  }));

  const combined = [
    ...damageLogs.map(d => ({ type: "damage" as const, username: d.user.username, amount: d.amount, source: d.source, text: null, createdAt: d.createdAt.toISOString() })),
    ...attackLogs.map(a => ({ type: "attack" as const, username: a.user.username, amount: a.amount, source: null, text: a.flavorText, createdAt: a.createdAt.toISOString() })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);

  return NextResponse.json({
    active: config.bossActive,
    bossHp: Math.max(0, config.bossHp),
    bossMaxHp: config.bossMaxHp,
    pct: config.bossMaxHp > 0 ? Math.max(0, (config.bossHp / config.bossMaxHp) * 100) : 0,
    defeated,
    sleeping,
    nightDamage: nightHp,
    wakeChancePct: currentWakeChance,
    killerUsername: killer?.username ?? null,
    leaderboard,
    recentLogs: combined,
    myDamage: myDamageAgg._sum.amount ?? 0,
  });
}
