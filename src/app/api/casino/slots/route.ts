import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { spinSlots } from "@/lib/casinoNight";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { isCasinoNightOpen, isBossFightLive } from "@/lib/casinoAccess";
import { healBossFromLoss } from "@/lib/bossHeal";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    casinoActive: isCasinoNightOpen(config),
    casinoOpen: config?.casinoOpen ?? true,
    myPoints: user.points,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Slots sits on the House floor switch, but a live boss fight opens it the
  // same way it opens roulette and scratch — otherwise the page would render as
  // playable (it reads the floor flag) while this route refused the bet.
  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.casinoOpen && !isBossFightLive(config)) {
    return NextResponse.json({ error: "The casino is closed" }, { status: 403 });
  }

  const { betAmount } = await req.json() as { betAmount: number };

  if (!betAmount || betAmount < 10 || !Number.isInteger(betAmount)) {
    return NextResponse.json({ error: "Minimum bet is 10 points" }, { status: 400 });
  }
  if (betAmount > user.points) {
    return NextResponse.json({ error: "Not enough points" }, { status: 400 });
  }

  const isAllIn = betAmount === user.points;
  const result = spinSlots(betAmount);
  const net = result.payout - betAmount;

  let newAchievement: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: betAmount } } });

    if (result.payout > 0) {
      await tx.user.update({ where: { id: user.id }, data: { points: { increment: result.payout } } });
      if (result.isTriple) {
        await logPoints(tx, user.id, net, `Slots TRIPLE ${result.reels[0]} — ×${result.multiplier}`);
      } else {
        await logPoints(tx, user.id, 0, `Slots double — bet returned`);
      }
    } else {
      await logPoints(tx, user.id, -betAmount, `Slots loss — ${result.reels.join(" ")}`);
    }

    // Phase 4: what the table takes, The House keeps.
    if (net < 0) await healBossFromLoss(tx, user.id, -net);

    if (isAllIn) {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "casino_all_in" } },
      });
      if (!existing) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "casino_all_in", claimed: true } });
        newAchievement = "casino_all_in";
        await tx.user.update({ where: { id: user.id }, data: { points: { increment: 300 } } });
        await logPoints(tx, user.id, 300, `Achievement unlocked: All Your Chips`);
      }
    }
  });

  return NextResponse.json({
    reels: result.reels,
    multiplier: result.multiplier,
    payout: result.payout,
    net,
    isTriple: result.isTriple,
    isDouble: result.isDouble,
    isAllIn,
    newAchievement: newAchievement
      ? ACHIEVEMENTS[newAchievement as keyof typeof ACHIEVEMENTS]
      : null,
  });
}
