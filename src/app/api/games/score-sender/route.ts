import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { GAME_REGISTRY } from "@/lib/gameRegistry";
import { logPoints } from "@/lib/pointLog";

function todayDateStr() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");

  const where = gameId ? { gameId, active: true } : { active: true };
  const senders = await prisma.scoreSender.findMany({
    where,
    include: { user: { select: { id: true, username: true } } },
    orderBy: { score: "desc" },
  });

  const hasItem = await prisma.userItem.findFirst({
    where: { userId: user.id, itemType: "score_sender", usesLeft: { gt: 0 } },
  });

  const mySenders = await prisma.scoreSender.findMany({
    where: { userId: user.id },
  });

  return NextResponse.json({ senders, hasItem: !!hasItem, mySenders });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, gameId, royalty, senderId } = await req.json();

  if (action === "publish") {
    if (!gameId || !(gameId in GAME_REGISTRY)) {
      return NextResponse.json({ error: "Invalid game" }, { status: 400 });
    }

    const game = GAME_REGISTRY[gameId as keyof typeof GAME_REGISTRY];

    const item = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType: "score_sender", usesLeft: { gt: 0 } },
    });
    if (!item) return NextResponse.json({ error: "You need a Score Sender item" }, { status: 400 });

    // Publish the player's best GAME score (same metric the leaderboard shows),
    // not their capped points — using it converts that score into points.
    const sessions = await prisma.gameSession.findMany({
      where: { userId: user.id, gameId, endedAt: { not: null } },
      select: { metadata: true },
    });
    let bestScore = 0;
    for (const s of sessions) {
      try {
        const v = JSON.parse(s.metadata || "{}")[game.leaderboardMetric];
        if (typeof v === "number" && v > bestScore) bestScore = v;
      } catch { /* ignore */ }
    }
    if (bestScore <= 0) {
      return NextResponse.json({ error: "Play the game first to have a score to publish" }, { status: 400 });
    }

    const royaltyNum = Math.max(10, Math.min(90, parseInt(royalty) || 50));

    await prisma.$transaction(async (tx) => {
      await tx.scoreSender.upsert({
        where: { userId_gameId: { userId: user.id, gameId } },
        create: { userId: user.id, gameId, score: bestScore, royalty: royaltyNum },
        update: { score: bestScore, royalty: royaltyNum, active: true },
      });
      await tx.userItem.update({ where: { id: item.id }, data: { usesLeft: { decrement: 1 } } });
    });

    return NextResponse.json({ ok: true, score: bestScore, royalty: royaltyNum });
  }

  if (action === "use") {
    const sender = await prisma.scoreSender.findUnique({
      where: { id: senderId },
      include: { user: true },
    });
    if (!sender || !sender.active) return NextResponse.json({ error: "Score sender not available" }, { status: 404 });
    if (sender.userId === user.id) return NextResponse.json({ error: "Can't use your own score sender" }, { status: 400 });

    const game = GAME_REGISTRY[sender.gameId as keyof typeof GAME_REGISTRY];
    if (!game) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

    const today = todayDateStr();
    const { _sum } = await prisma.gameSession.aggregate({
      where: { userId: user.id, gameId: sender.gameId, dailyDate: today, endedAt: { not: null } },
      _sum: { pointsEarned: true },
    });
    const alreadyEarned = _sum.pointsEarned ?? 0;
    if (alreadyEarned >= game.dailyCap) {
      return NextResponse.json({ error: "Daily cap already reached for this game" }, { status: 400 });
    }

    const available = game.dailyCap - alreadyEarned;
    // Convert the published game score into points via the game's rate, capped
    // at the remaining daily allowance.
    const scorePts = Math.floor(sender.score / game.conversionRate);
    const pointsFromSender = Math.min(scorePts, available);
    const royaltyPts = Math.floor(pointsFromSender * sender.royalty / 100);
    const playerPts = pointsFromSender - royaltyPts;

    await prisma.$transaction(async (tx) => {
      await tx.gameSession.create({
        data: {
          userId: user.id,
          gameId: sender.gameId,
          endedAt: new Date(),
          durationSecs: 0,
          metadata: JSON.stringify({ scoreSender: true, senderId: sender.id }),
          pointsEarned: pointsFromSender,
          dailyDate: today,
        },
      });
      if (playerPts > 0) {
        await tx.user.update({ where: { id: user.id }, data: { points: { increment: playerPts } } });
        await logPoints(tx, user.id, playerPts, `Score Sender — ${game.name} (${sender.user.username}'s score, ${sender.royalty}% royalty)`);
      }
      if (royaltyPts > 0) {
        await tx.user.update({ where: { id: sender.userId }, data: { points: { increment: royaltyPts } } });
        await logPoints(tx, sender.userId, royaltyPts, `Score Sender royalty — ${game.name} (used by ${user.username})`);
      }
    });

    return NextResponse.json({ ok: true, pointsEarned: playerPts, royaltyPaid: royaltyPts, dailyTotal: alreadyEarned + pointsFromSender });
  }

  // Remove your own published score from the market (deactivate — re-publishing
  // reactivates it).
  if (action === "unpublish") {
    if (!gameId) return NextResponse.json({ error: "Invalid game" }, { status: 400 });
    await prisma.scoreSender.updateMany({
      where: { userId: user.id, gameId },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
