import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { GAME_REGISTRY } from "@/lib/gameRegistry";
import { logPoints } from "@/lib/pointLog";

function todayDateStr() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, coinsEarned = 0, metadata = {}, submit = false } = await req.json();

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.endedAt) {
    return NextResponse.json({ error: "Session already ended" }, { status: 409 });
  }

  const now = new Date();
  const durationSecs = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);
  const today = todayDateStr();

  if (!submit) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        endedAt: now,
        durationSecs,
        metadata: JSON.stringify(metadata),
        pointsEarned: 0,
        dailyDate: today,
      },
    });
    return NextResponse.json({ pointsEarned: 0, dailyTotal: 0, dailyCap: 0 });
  }

  const game = GAME_REGISTRY[session.gameId as keyof typeof GAME_REGISTRY];
  if (!game) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

  const { _sum } = await prisma.gameSession.aggregate({
    where: {
      userId: user.id,
      gameId: session.gameId,
      dailyDate: today,
      endedAt: { not: null },
    },
    _sum: { pointsEarned: true },
  });

  const alreadyEarned = _sum.pointsEarned ?? 0;
  const rawPts = Math.floor(coinsEarned / game.conversionRate);
  const pointsEarned = Math.max(0, Math.min(rawPts, game.dailyCap - alreadyEarned));

  await prisma.$transaction(async (tx) => {
    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        endedAt: now,
        durationSecs,
        metadata: JSON.stringify(metadata),
        pointsEarned,
        dailyDate: today,
      },
    });

    if (pointsEarned > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { points: { increment: pointsEarned } },
      });
      await logPoints(
        tx,
        user.id,
        pointsEarned,
        `Penguin Flyer — ${pointsEarned} pts (${coinsEarned} coins)`
      );
    }
  });

  return NextResponse.json({
    pointsEarned,
    dailyTotal: alreadyEarned + pointsEarned,
    dailyCap: game.dailyCap,
  });
}
