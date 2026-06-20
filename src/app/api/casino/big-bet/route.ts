import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { BASE_MULTIPLIER, ALL_IN_MULTIPLIER } from "@/lib/casinoNight";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });

  const pendingBets = await prisma.bigBet.findMany({
    where: { status: "pending" },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { stake: "desc" },
  });

  const approvedBet = await prisma.bigBet.findFirst({
    where: { status: "approved" },
    include: { user: { select: { id: true, username: true } } },
  });

  const completedBets = await prisma.bigBet.findMany({
    where: { status: "completed" },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { resolvedAt: "desc" },
    take: 10,
  });

  const myBet = await prisma.bigBet.findFirst({
    where: { userId: user.id, status: { in: ["pending", "approved"] } },
  });

  const biggest = pendingBets[0] ?? null;

  return NextResponse.json({
    casinoActive: config?.casinoNightActive ?? false,
    revealAt: config?.bigBetRevealAt ?? null,
    selectedGame: config?.bigBetGameType || null,
    myPoints: user.points,
    myBet: myBet ? {
      id: myBet.id,
      title: myBet.title,
      description: myBet.description,
      stake: myBet.stake,
      multiplier: myBet.multiplier,
      isAllIn: myBet.isAllIn,
      status: myBet.status,
    } : null,
    biggestBet: biggest ? {
      username: biggest.user.username,
      stake: biggest.stake,
      isAllIn: biggest.isAllIn,
    } : null,
    approvedBet: approvedBet ? {
      id: approvedBet.id,
      username: approvedBet.user.username,
      userId: approvedBet.user.id,
      title: approvedBet.title,
      description: approvedBet.description,
      stake: approvedBet.stake,
      multiplier: approvedBet.multiplier,
      isAllIn: approvedBet.isAllIn,
    } : null,
    completedBets: completedBets.map((b) => ({
      id: b.id,
      username: b.user.username,
      title: b.title,
      stake: b.stake,
      outcome: b.outcome,
      payout: b.payout,
      multiplier: b.multiplier,
    })),
    pendingCount: pendingBets.length,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.casinoNightActive) {
    return NextResponse.json({ error: "Casino Night is not active" }, { status: 403 });
  }

  const { title, description, stake } = await req.json() as {
    title: string;
    description: string;
    stake: number;
  };

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
  }
  if (!stake || stake < 50 || !Number.isInteger(stake)) {
    return NextResponse.json({ error: "Minimum stake is 50 points" }, { status: 400 });
  }
  if (stake > user.points) {
    return NextResponse.json({ error: "Not enough points" }, { status: 400 });
  }

  const existing = await prisma.bigBet.findFirst({
    where: { userId: user.id, status: { in: ["pending", "approved"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have an active submission" }, { status: 409 });
  }

  const isAllIn = stake === user.points;
  const multiplier = isAllIn ? ALL_IN_MULTIPLIER : BASE_MULTIPLIER;

  let newAchievement: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: stake } } });
    await logPoints(tx, user.id, -stake, `Big Bet Show — "${title.trim()}" escrowed (${isAllIn ? "ALL IN ×5" : "×3"})`);
    await tx.bigBet.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description.trim(),
        stake,
        multiplier,
        isAllIn,
      },
    });

    if (isAllIn) {
      const ach = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "big_bet_all_in" } },
      });
      if (!ach) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "big_bet_all_in" } });
        await tx.user.update({ where: { id: user.id }, data: { points: { increment: 200 } } });
        await logPoints(tx, user.id, 200, `Achievement unlocked: Maximum Exposure`);
        newAchievement = "big_bet_all_in";
      }
    }
  });

  return NextResponse.json({
    ok: true,
    multiplier,
    isAllIn,
    newAchievement: newAchievement
      ? ACHIEVEMENTS[newAchievement as keyof typeof ACHIEVEMENTS]
      : null,
  });
}
