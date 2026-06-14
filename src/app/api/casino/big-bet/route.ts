import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });

  // Only show revealed bets to players; pending/resolved are hidden until reveal time
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
      ? { id: myBet.id, title: myBet.title, description: myBet.description, stake: myBet.stake }
      : null,
    bets: bets.map((b) => ({
      id: b.id,
      username: b.user.username,
      isMe: b.userId === user.id,
      title: b.title,
      description: b.description,
      stake: b.stake,
      multiplier: b.multiplier,
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

  // One pending bet per player at a time
  const existing = await prisma.bigBet.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending bet for tonight's show" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: stake } } });
    await logPoints(tx, user.id, -stake, `Big Bet Show — "${title}" (escrowed)`);
    await tx.bigBet.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description.trim(),
        stake,
        multiplier: 1.5,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
