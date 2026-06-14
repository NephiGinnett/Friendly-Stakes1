import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { ACHIEVEMENTS } from "@/lib/achievements";

const BASE_MULTIPLIER = 1.5;
const ALL_IN_MULTIPLIER = 2.0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });

  const now = new Date();
  const revealAt = config?.bigBetRevealAt;
  const showRevealed = revealAt && now >= revealAt;

  const bets = await prisma.bigBet.findMany({
    where: showRevealed ? { status: { in: ["resolved", "revealed"] } } : { status: "pending" },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });

  const myBet = await prisma.bigBet.findFirst({
    where: { userId: user.id, status: "pending" },
  });

  return NextResponse.json({
    casinoActive: config?.casinoNightActive ?? false,
    revealAt: revealAt ?? null,
    showRevealed,
    myPoints: user.points,
    myPendingBet: myBet
      ? {
          id: myBet.id, title: myBet.title, description: myBet.description,
          stake: myBet.stake, gameType: myBet.gameType, isAllIn: myBet.isAllIn,
          multiplier: myBet.multiplier,
        }
      : null,
    bets: bets.map((b) => ({
      id: b.id,
      username: b.user.username,
      isMe: b.userId === user.id,
      title: b.title,
      description: b.description,
      gameType: b.gameType,
      stake: b.stake,
      multiplier: b.multiplier,
      isAllIn: b.isAllIn,
      outcome: showRevealed ? b.outcome : null,
      payout: showRevealed ? b.payout : null,
      status: b.status,
      createdAt: b.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.casinoNightActive) {
    return NextResponse.json({ error: "Casino Night is not active" }, { status: 403 });
  }

  const { title, description, stake, gameType } = await req.json() as {
    title: string;
    description: string;
    stake: number;
    gameType?: string;
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
    where: { userId: user.id, status: "pending" },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending bet for tonight's show" }, { status: 409 });
  }

  const isAllIn = stake === user.points;
  const multiplier = isAllIn ? ALL_IN_MULTIPLIER : BASE_MULTIPLIER;
  const resolvedGameType = ["roulette", "blackjack", "custom"].includes(gameType ?? "")
    ? (gameType as string)
    : "custom";

  let newAchievement: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: stake } } });
    await logPoints(tx, user.id, -stake, `Big Bet Show — "${title.trim()}" escrowed (${isAllIn ? "ALL IN ×2.0" : "×1.5"})`);
    await tx.bigBet.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description.trim(),
        gameType: resolvedGameType,
        stake,
        multiplier,
        isAllIn,
      },
    });

    if (isAllIn) {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "big_bet_all_in" } },
      });
      if (!existing) {
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
