import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const CHALLENGE_FEE = 50;
const BARON_RATE = 0.15;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { outcome } = await req.json();
  if (outcome !== "completed" && outcome !== "refund") {
    return NextResponse.json({ error: "outcome must be 'completed' or 'refund'" }, { status: 400 });
  }

  const challenge = await prisma.challenge.findUnique({ where: { id: parseInt(params.id) } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (challenge.status === "settled" || challenge.status === "cancelled") {
    return NextResponse.json({ error: "Challenge is already closed" }, { status: 400 });
  }

  if (outcome === "refund") {
    await prisma.$transaction(async (tx) => {
      // Only refund escrowed offer if not already returned (pending/active/voting all have it held)
      await tx.user.update({ where: { id: challenge.creatorId }, data: { points: { increment: challenge.offer } } });
      await logPoints(tx, challenge.creatorId, challenge.offer, `Admin refund: bounty "${challenge.title}"`);
      await tx.challenge.update({
        where: { id: challenge.id },
        data: { status: "cancelled" },
      });
    });
    return NextResponse.json({ ok: true, outcome: "refund" });
  }

  // outcome === "completed" — pay out acceptor
  if (!challenge.acceptedById) {
    return NextResponse.json({ error: "No one has accepted this challenge yet — cannot mark completed" }, { status: 400 });
  }

  const basePayout = (challenge.offer - CHALLENGE_FEE) * challenge.multiplier;

  const baronRecords = await prisma.userAchievement.findMany({
    where: { achievementId: "baron", userId: { not: challenge.acceptedById } },
    include: { user: { select: { id: true } } },
  });
  const numBarons = baronRecords.length;
  const baronPool = numBarons > 0 ? Math.floor(basePayout * BARON_RATE) : 0;
  const perBaron = numBarons > 0 ? Math.floor(baronPool / numBarons) : 0;
  const winnerPayout = basePayout - baronPool;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: challenge.acceptedById! }, data: { points: { increment: winnerPayout } } });
    await logPoints(tx, challenge.acceptedById!, winnerPayout, `Admin settled — completed bounty: "${challenge.title}"`);
    for (const baron of baronRecords) {
      if (perBaron > 0) {
        await tx.user.update({ where: { id: baron.user.id }, data: { points: { increment: perBaron } } });
        await logPoints(tx, baron.user.id, perBaron, `Baron tax from bounty: "${challenge.title}"`);
      }
    }
    await tx.challenge.update({
      where: { id: challenge.id },
      data: { status: "settled", winnerUserId: challenge.acceptedById, settledAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true, outcome: "completed" });
}
