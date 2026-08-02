import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { scratchResult, SCRATCH_COSTS, ScratchTier } from "@/lib/casinoNight";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { isCasinoNightOpen, isBossFightLive } from "@/lib/casinoAccess";
import { SHOP_ITEMS } from "@/lib/shop";
import { healBossFromLoss } from "@/lib/bossHeal";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  const recent = await prisma.scratchCard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    // casinoActive = the floor is playable (Casino Night OR a live boss fight).
    // casinoNightActive = the real Casino Night event, which additionally
    // unlocks the Strike It Rich headline act.
    casinoActive: isCasinoNightOpen(config),
    casinoNightActive: !!config?.casinoNightActive,
    bossFightLive: isBossFightLive(config),
    jackpot: config?.scratchJackpot ?? 0,
    costs: SCRATCH_COSTS,
    myPoints: user.points,
    recent: recent.map((c) => ({
      id: c.id,
      tier: c.tier,
      cost: c.cost,
      grid: JSON.parse(c.grid),
      payout: c.payout,
      isJackpot: c.isJackpot,
      createdAt: c.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tier } = (await req.json()) as { tier: ScratchTier };
  if (tier !== "basic" && tier !== "premium") {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config || !isCasinoNightOpen(config)) {
    return NextResponse.json({ error: "Casino Night is not active" }, { status: 403 });
  }

  const cost = SCRATCH_COSTS[tier];
  if (user.points < cost) {
    return NextResponse.json({ error: "Not enough points" }, { status: 400 });
  }

  const jackpotPool = config.scratchJackpot;
  const { grid, payout, isJackpot, itemsWon } = scratchResult(tier, jackpotPool);

  let newAchievement: string | null = null;
  let bossHealed = 0;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: cost } } });
    await logPoints(tx, user.id, -cost, `Scratch card (${tier}) purchased`);
    await tx.houseConfig.update({ where: { id: 1 }, data: { scratchJackpot: { increment: Math.floor(cost * 0.75) } } });
    await tx.scratchCard.create({
      data: { userId: user.id, tier, cost, grid: JSON.stringify(grid), payout, isJackpot },
    });

    if (isJackpot) {
      await tx.user.update({ where: { id: user.id }, data: { points: { increment: jackpotPool } } });
      await logPoints(tx, user.id, jackpotPool, `Scratch card JACKPOT — Casino Night`);
      await tx.houseConfig.update({ where: { id: 1 }, data: { scratchJackpot: 0 } });
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "scratch_jackpot" } },
      });
      if (!existing) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "scratch_jackpot", claimed: true } });
        newAchievement = "scratch_jackpot";
      }
    } else if (payout > 0) {
      await tx.user.update({ where: { id: user.id }, data: { points: { increment: payout } } });
      await logPoints(tx, user.id, payout, `Scratch card win (${tier})`);
    }

    // Phase 4: a card that pays back less than it cost feeds The House the difference.
    const netLoss = cost - (isJackpot ? jackpotPool : payout);
    if (netLoss > 0) bossHealed = await healBossFromLoss(tx, user.id, netLoss);

    // Gift lines award power-up items.
    for (const itemType of itemsWon) {
      const def = SHOP_ITEMS[itemType as keyof typeof SHOP_ITEMS];
      if (!def) continue;
      const existing = await tx.userItem.findFirst({ where: { userId: user.id, itemType, usesLeft: { gt: 0 } } });
      if (existing) {
        await tx.userItem.update({ where: { id: existing.id }, data: { usesLeft: { increment: def.maxUses } } });
      } else {
        await tx.userItem.create({ data: { userId: user.id, itemType, usesLeft: def.maxUses } });
      }
    }
  });

  const updatedConfig = await prisma.houseConfig.findUnique({ where: { id: 1 } });

  return NextResponse.json({
    bossHealed,
    grid,
    payout,
    isJackpot,
    itemsWon: itemsWon.map((t) => {
      const def = SHOP_ITEMS[t as keyof typeof SHOP_ITEMS];
      return { itemType: t, name: def?.name ?? t, emoji: def?.emoji ?? "🎁" };
    }),
    jackpotAwarded: isJackpot ? jackpotPool : 0,
    newJackpot: updatedConfig?.scratchJackpot ?? 0,
    newAchievement: newAchievement
      ? ACHIEVEMENTS[newAchievement as keyof typeof ACHIEVEMENTS]
      : null,
  });
}
