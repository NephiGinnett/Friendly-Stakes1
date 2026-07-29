import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { formatPoints } from "@/lib/utils";
import { BASE_MULTIPLIER, ALL_IN_MULTIPLIER, BIG_BET_GAME_IDS, spinRoulette, resolveRoulette, rouletteColor, spinSlots, type BetType } from "@/lib/casinoNight";
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
      stake: myBet.stake,
      multiplier: myBet.multiplier,
      isAllIn: myBet.isAllIn,
      status: myBet.status,
      gameType: myBet.gameType,
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
      stake: approvedBet.stake,
      multiplier: approvedBet.multiplier,
      isAllIn: approvedBet.isAllIn,
      gameType: approvedBet.gameType,
    } : null,
    completedBets: completedBets.map((b) => ({
      id: b.id,
      username: b.user.username,
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

  const body = await req.json() as {
    action?: string;
    title?: string;
    description?: string;
    stake?: number;
    gameType?: string;
    betType?: string;
    betValue?: string;
  };

  // VIP self-resolves their approved Big Bet by playing their chosen game live.
  if (body.action === "resolve") {
    return resolveBigBet(user.id, config, body);
  }

  const { title, description, stake, gameType } = body;

  if (!stake || stake < 50 || !Number.isInteger(stake)) {
    return NextResponse.json({ error: "Minimum stake is 50 points" }, { status: 400 });
  }
  // Player picks which game they'll play on the live stage (defaults to roulette).
  const chosenGame = BIG_BET_GAME_IDS.includes(gameType ?? "") ? gameType! : "roulette";
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
    await logPoints(tx, user.id, -stake, `Strike It Rich — ${formatPoints(stake)} pts escrowed (${isAllIn ? "ALL IN ×5" : "×3"})`);
    await tx.bigBet.create({
      data: {
        userId: user.id,
        title: title?.trim() || "Strike It Rich",
        description: description?.trim() || `${formatPoints(stake)} pts`,
        stake,
        multiplier,
        isAllIn,
        gameType: chosenGame,
      },
    });

    if (isAllIn) {
      const ach = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "big_bet_all_in" } },
      });
      if (!ach) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "big_bet_all_in", claimed: true } });
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

// The selected VIP plays their chosen game live; the round decides the outcome
// and the payout is their normal game winnings times their bonus multiplier
// (stake returned on a win/push, escrow forfeited on a loss).
async function resolveBigBet(
  userId: number,
  config: { bigBetForce5x?: boolean } | null,
  body: { betType?: string; betValue?: string },
) {
  const bet = await prisma.bigBet.findFirst({ where: { userId, status: "approved" } });
  if (!bet) {
    return NextResponse.json({ error: "You don't have an approved Big Bet to play" }, { status: 400 });
  }

  const multiplier = config?.bigBetForce5x ? 5.0 : bet.multiplier;
  const stake = bet.stake;

  let won = false;
  let pushed = false;
  let nativeWinnings = 0; // normal net profit for this game outcome
  let detail: Record<string, unknown> = {};

  if (bet.gameType === "roulette") {
    const validTypes = ["number", "color", "dozen", "half", "even_odd"];
    const betType = body.betType ?? "";
    const betValue = body.betValue ?? "";
    if (!validTypes.includes(betType)) {
      return NextResponse.json({ error: "Choose your roulette bet first" }, { status: 400 });
    }
    const result = spinRoulette();
    nativeWinnings = resolveRoulette(result, betType as BetType, betValue, stake);
    won = nativeWinnings > 0;
    detail = { result, color: rouletteColor(result), betType, betValue };
  } else if (bet.gameType === "slots") {
    const spin = spinSlots(stake);
    if (spin.isTriple) { won = true; nativeWinnings = spin.payout - stake; }
    else if (spin.isDouble) { pushed = true; }
    detail = { reels: spin.reels, isTriple: spin.isTriple, isDouble: spin.isDouble, multiplier: spin.multiplier };
  } else {
    return NextResponse.json({ error: "This game can't be played live yet — ask the admin to resolve it." }, { status: 400 });
  }

  const bonusWinnings = won ? Math.floor(nativeWinnings * multiplier) : 0;
  const payoutCredit = won ? stake + bonusWinnings : pushed ? stake : 0;
  const outcome = won ? "win" : pushed ? "push" : "loss";

  await prisma.$transaction(async (tx) => {
    await tx.bigBet.update({
      where: { id: bet.id },
      data: { outcome, payout: payoutCredit, multiplier, status: "completed", resolvedAt: new Date() },
    });
    if (won) {
      await tx.user.update({ where: { id: userId }, data: { points: { increment: payoutCredit } } });
      await logPoints(tx, userId, payoutCredit, `Strike It Rich WIN — ${bet.gameType} (winnings ×${multiplier} bonus)`);
    } else if (pushed) {
      await tx.user.update({ where: { id: userId }, data: { points: { increment: payoutCredit } } });
      await logPoints(tx, userId, payoutCredit, `Strike It Rich push — ${bet.gameType}, stake returned`);
    }
  });

  return NextResponse.json({
    ok: true,
    gameType: bet.gameType,
    won,
    pushed,
    stake,
    multiplier,
    nativeWinnings: won ? nativeWinnings : 0,
    bonusWinnings,
    payout: payoutCredit,
    detail,
  });
}
