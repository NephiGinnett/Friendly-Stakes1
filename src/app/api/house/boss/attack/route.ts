import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { log } from "@/lib/pointLog";
import { isStrikeWindow, wakeChance, nightDamageDealt, executeTargetedStrike, tomorrowUtcDate } from "@/lib/houseStrike";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.bossActive) return NextResponse.json({ error: "Boss is not active." }, { status: 400 });
  if (config.bossHp <= 0) return NextResponse.json({ error: "The House is already defeated." }, { status: 400 });

  const { amount } = await req.json();
  if (!amount || amount < 50) return NextResponse.json({ error: "Minimum attack is 50 pts." }, { status: 400 });
  if (amount > user.points) return NextResponse.json({ error: "Not enough points." }, { status: 400 });

  const sleeping = !isStrikeWindow();

  // 2 pts = 1 HP
  const hpDamage = Math.floor(amount / 2);
  const newHp = Math.max(0, config.bossHp - hpDamage);
  const killed = newHp === 0;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: amount } } });
    await tx.houseDamageLog.create({ data: { userId: user.id, amount: hpDamage, source: sleeping ? "sleep_attack" : "attack" } });
    await tx.houseConfig.update({
      where: { id: 1 },
      data: { bossHp: newHp, ...(killed ? { bossActive: false, killerUserId: user.id } : {}) },
    });
    await log(user.id, -amount, `Boss Attack: dealt ${hpDamage} HP to The House`);
  });

  // Resistance fighter achievement: 200+ total HP dealt
  const myTotal = await prisma.houseDamageLog.aggregate({ where: { userId: user.id }, _sum: { amount: true } });
  if ((myTotal._sum.amount ?? 0) >= 200) {
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId: user.id, achievementId: "resistance_fighter" } },
      create: { userId: user.id, achievementId: "resistance_fighter" },
      update: {},
    });
  }

  if (killed) {
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId: user.id, achievementId: "last_stand" } },
      create: { userId: user.id, achievementId: "last_stand" },
      update: {},
    });
  }

  // ── Wake-up check ──────────────────────────────────────────────────────────
  let wakeResult: { flavorText: string; amount: number } | null = null;

  if (sleeping && !killed) {
    const nightHp = await nightDamageDealt();
    const chance = wakeChance(nightHp);
    const rolled = Math.random() * 100;

    if (rolled < chance) {
      // House wakes — targeted strike on this attacker + revoke tomorrow's privileges
      const strike = await executeTargetedStrike(user.id);
      if (strike) {
        await prisma.user.update({
          where: { id: user.id },
          data: { houseBanDate: tomorrowUtcDate() },
        });
        wakeResult = { flavorText: strike.flavorText, amount: strike.amount };
      }
    }
  }

  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });

  return NextResponse.json({
    ok: true,
    hpDealt: hpDamage,
    newBossHp: newHp,
    killed,
    newPoints: updated!.points,
    woke: !!wakeResult,
    wakeResult,
  });
}
