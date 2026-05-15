import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
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
    await logPoints(tx, user.id, -amount, `Boss Attack: dealt ${hpDamage} HP to The House`);
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

    // ── Post-battle awards ────────────────────────────────────────────────────
    // Top damage dealer → Public Enemy #1 achievement (400 pts) + Signal Scrambler item
    const topDamage = await prisma.houseDamageLog.groupBy({
      by: ["userId"],
      where: { source: { not: "sleep_game" } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    });
    if (topDamage.length > 0) {
      const topId = topDamage[0].userId;
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: topId, achievementId: "top_damage" } },
        create: { userId: topId, achievementId: "top_damage" },
        update: {},
      });
      await prisma.user.update({ where: { id: topId }, data: { points: { increment: 400 } } });
      await prisma.pointLog.create({ data: { userId: topId, amount: 400, reason: "Achievement: Public Enemy #1 — top damage dealer" } });
      // Signal Scrambler — permanent ward (usesLeft: 0 = infinite/passive, handled by ward check)
      await prisma.userItem.create({ data: { userId: topId, itemType: "signal_scrambler", usesLeft: 999 } });
    }

    // Top healer (most HP fed to boss via game losses) → Unwitting Accomplice (300 pts)
    const topHeal = await prisma.houseDamageLog.groupBy({
      by: ["userId"],
      where: { source: "sleep_game" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    });
    if (topHeal.length > 0 && (topHeal[0]._sum.amount ?? 0) > 0) {
      const healId = topHeal[0].userId;
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: healId, achievementId: "top_healer" } },
        create: { userId: healId, achievementId: "top_healer" },
        update: {},
      });
      await prisma.user.update({ where: { id: healId }, data: { points: { increment: 300 } } });
      await prisma.pointLog.create({ data: { userId: healId, amount: 300, reason: "Achievement: Unwitting Accomplice — top healer" } });
    }
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
