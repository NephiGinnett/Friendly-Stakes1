import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const MONITOR_PER_LEG: Record<number, number> = { 100: 1, 200: 2, 300: 3 };
const MULTIPLIERS = [2, 3, 5, 8, 13];

// POST { parlayId, responses: { legId: number; accepted: boolean }[] }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { parlayId, responses } = await req.json();

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    include: { legs: true, match: true },
  });
  if (!parlay) return NextResponse.json({ error: "Parlay not found" }, { status: 404 });
  if (parlay.opponentId !== user.id) return NextResponse.json({ error: "Not your parlay to respond to" }, { status: 403 });
  if (parlay.status !== "pending") return NextResponse.json({ error: "Parlay is no longer pending" }, { status: 400 });

  const now = new Date();
  const oneHourBefore = new Date(new Date(parlay.match.kickoff).getTime() - 60 * 60 * 1000);
  if (now >= oneHourBefore) {
    return NextResponse.json({ error: "Response window has closed (1h before kickoff)" }, { status: 400 });
  }

  if (!Array.isArray(responses) || responses.length !== parlay.legs.length) {
    return NextResponse.json({ error: "Must respond to all legs" }, { status: 400 });
  }

  // Apply accept/reject to each leg
  await prisma.$transaction(
    responses.map((r: { legId: number; accepted: boolean }) =>
      prisma.parlayLeg.update({
        where: { id: r.legId },
        data: { accepted: r.accepted },
      })
    )
  );

  const acceptedCount = responses.filter((r: { accepted: boolean }) => r.accepted).length;

  // Refund rejected legs to proposer
  const rejectedCount = responses.filter((r: { accepted: boolean }) => !r.accepted).length;
  const refund = rejectedCount * parlay.costPerLeg;

  // Award MONITOR cans for accepted legs
  const cansEarned = acceptedCount * (MONITOR_PER_LEG[parlay.costPerLeg] ?? 1);

  if (acceptedCount === 0) {
    // All legs rejected — cancel parlay, full refund
    await prisma.$transaction(async (tx) => {
      await tx.parlay.update({ where: { id: parlayId }, data: { status: "cancelled" } });
      await tx.user.update({ where: { id: parlay.proposerId }, data: { points: { increment: parlay.totalEscrowed } } });
      await logPoints(tx, parlay.proposerId, parlay.totalEscrowed, "Parlay cancelled — all legs rejected, full refund");
    });
    return NextResponse.json({ ok: true, acceptedCount: 0, cancelled: true });
  }

  const activePayout = acceptedCount * parlay.costPerLeg * MULTIPLIERS[acceptedCount - 1];

  await prisma.$transaction(async (tx) => {
    await tx.parlay.update({
      where: { id: parlayId },
      data: {
        status: "active",
        totalEscrowed: acceptedCount * parlay.costPerLeg,
        payout: activePayout,
      },
    });
    // Refund rejected legs
    if (refund > 0) {
      await tx.user.update({ where: { id: parlay.proposerId }, data: { points: { increment: refund } } });
      await logPoints(tx, parlay.proposerId, refund, `Parlay: ${rejectedCount} leg(s) rejected — refund`);
    }
    // Award MONITOR cans
    if (cansEarned > 0) {
      await tx.worldCupEntry.update({
        where: { userId: user.id },
        data: { monitorCans: { increment: cansEarned } },
      });
    }
  });

  return NextResponse.json({ ok: true, acceptedCount, cansEarned, activePayout });
}
