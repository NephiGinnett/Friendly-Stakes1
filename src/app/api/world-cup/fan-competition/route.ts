import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const DONATION_SCORE_RATE = 0.5; // 100 pts donated = 50 fan score

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [config, leaderboard, myEntry] = await Promise.all([
    prisma.houseConfig.findUnique({ where: { id: 1 } }),
    prisma.worldCupEntry.findMany({
      where: { fanScore: { gt: 0 } },
      orderBy: { fanScore: "desc" },
      include: { user: { select: { id: true, username: true } }, team: true },
      take: 20,
    }),
    prisma.worldCupEntry.findUnique({
      where: { userId: user.id },
      include: { team: true },
    }),
  ]);

  const pot = config?.wcFanPot ?? 0;
  const myRank = leaderboard.findIndex((e) => e.userId === user.id) + 1;

  return NextResponse.json({
    pot,
    myScore: myEntry?.fanScore ?? 0,
    myRank: myRank > 0 ? myRank : null,
    myPoints: user.points,
    hasEntry: !!myEntry,
    leaderboard: leaderboard.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      username: e.user.username,
      teamName: e.team.name,
      teamFlag: e.team.flag,
      fanScore: e.fanScore,
    })),
  });
}

// POST { amount: number } — donate points to the fan pot
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount } = await req.json();
  if (!amount || amount < 1 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: "Amount must be a positive integer" }, { status: 400 });
  }
  if (amount > user.points) {
    return NextResponse.json({ error: "Not enough points" }, { status: 400 });
  }

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "You must be entered in the World Cup event" }, { status: 403 });

  const scoreGain = Math.floor(amount * DONATION_SCORE_RATE);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: amount } } });
    await logPoints(tx, user.id, -amount, `Fan Competition donation — +${scoreGain} fan score`);
    await tx.worldCupEntry.update({
      where: { userId: user.id },
      data: { fanScore: { increment: scoreGain } },
    });
    await tx.houseConfig.update({
      where: { id: 1 },
      data: { wcFanPot: { increment: amount } },
    });
  });

  return NextResponse.json({ ok: true, scoreGain, newPot: (await prisma.houseConfig.findUnique({ where: { id: 1 } }))?.wcFanPot });
}
