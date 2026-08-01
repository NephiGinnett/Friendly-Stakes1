import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DAMAGE_WHERE, HEAL_WHERE } from "@/lib/houseLog";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config || config.bossHp > 0 || config.bossMaxHp === 0) {
    return NextResponse.json({ available: false });
  }

  const killer = config.killerUserId
    ? await prisma.user.findUnique({ where: { id: config.killerUserId }, select: { username: true } })
    : null;

  // Damage rankings — real damage only, excluding heals and sleep-window noise
  const damageRaw = await prisma.houseDamageLog.groupBy({
    by: ["userId"],
    where: DAMAGE_WHERE,
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  // Heal rankings — HP actually restored by players losing at the tables
  const healRaw = await prisma.houseDamageLog.groupBy({
    by: ["userId"],
    where: HEAL_WHERE,
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const allUserIds = Array.from(new Set([...damageRaw.map(r => r.userId), ...healRaw.map(r => r.userId)]));
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, username: true },
  });

  const nameOf = (id: number) => users.find(u => u.id === id)?.username ?? "?";

  const damageBoard = damageRaw.map(r => ({
    username: nameOf(r.userId),
    hp: r._sum.amount ?? 0,
    isKiller: r.userId === config.killerUserId,
  }));

  const healBoard = healRaw
    .map(r => ({ username: nameOf(r.userId), hp: r._sum.amount ?? 0 }))
    .filter(r => r.hp > 0);

  return NextResponse.json({
    available: true,
    killerUsername: killer?.username ?? null,
    damageBoard,
    healBoard,
  });
}
