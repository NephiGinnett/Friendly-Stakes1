import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { spinRoulette, resolveRoulette, BetType } from "@/lib/casinoNight";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    casinoActive: config?.casinoNightActive ?? false,
    myPoints: user.points,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.casinoNightActive) {
    return NextResponse.json({ error: "Casino Night is not active" }, { status: 403 });
  }

  const { betAmount, betType, betValue } = await req.json() as {
    betAmount: number;
    betType: BetType;
    betValue: string;
  };

  if (!betAmount || betAmount < 10 || !Number.isInteger(betAmount)) {
    return NextResponse.json({ error: "Minimum bet is 10 points" }, { status: 400 });
  }
  if (betAmount > user.points) {
    return NextResponse.json({ error: "Not enough points" }, { status: 400 });
  }

  const validTypes: BetType[] = ["number", "color", "dozen", "half", "even_odd"];
  if (!validTypes.includes(betType)) {
    return NextResponse.json({ error: "Invalid bet type" }, { status: 400 });
  }

  const isAllIn = betAmount === user.points;
  const result = spinRoulette();
  const winAmount = resolveRoulette(result, betType, betValue, betAmount);
  const net = winAmount - betAmount;

  let newAchievement: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: betAmount } } });

    if (winAmount > 0) {
      await tx.user.update({ where: { id: user.id }, data: { points: { increment: winAmount + betAmount } } });
      await logPoints(tx, user.id, net, `Roulette win — ${betType} ${betValue} on ${result}`);
    } else {
      await logPoints(tx, user.id, -betAmount, `Roulette loss — ${betType} ${betValue} on ${result}`);
    }

    await tx.rouletteGame.create({
      data: { userId: user.id, betAmount, betType, betValue, result, payout: winAmount, isAllIn },
    });

    if (isAllIn) {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "casino_all_in" } },
      });
      if (!existing) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "casino_all_in" } });
        newAchievement = "casino_all_in";
        await tx.user.update({ where: { id: user.id }, data: { points: { increment: 300 } } });
        await logPoints(tx, user.id, 300, `Achievement unlocked: All Your Chips`);
      }
    }
  });

  return NextResponse.json({
    result,
    betAmount,
    winAmount,
    net,
    isAllIn,
    newAchievement: newAchievement
      ? ACHIEVEMENTS[newAchievement as keyof typeof ACHIEVEMENTS]
      : null,
  });
}
