import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

// POST { parlayId, votes: { legId: number; success: boolean }[] }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { parlayId, votes } = await req.json();

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    include: { legs: true },
  });
  if (!parlay) return NextResponse.json({ error: "Parlay not found" }, { status: 404 });
  if (parlay.proposerId !== user.id && parlay.opponentId !== user.id) {
    return NextResponse.json({ error: "Not your parlay" }, { status: 403 });
  }
  if (parlay.status !== "voting" && parlay.status !== "active") {
    return NextResponse.json({ error: "Parlay is not in voting phase" }, { status: 400 });
  }

  // Check not already voted
  const alreadyVoted = await prisma.parlayVoteLog.findUnique({
    where: { parlayId_userId: { parlayId, userId: user.id } },
  });
  if (alreadyVoted) return NextResponse.json({ error: "Already voted" }, { status: 409 });

  const activeLegIds = parlay.legs.filter((l) => l.accepted === true).map((l) => l.id);
  const isProposer = parlay.proposerId === user.id;

  // Apply this player's votes to active legs only
  await prisma.$transaction([
    ...votes
      .filter((v: { legId: number }) => activeLegIds.includes(v.legId))
      .map((v: { legId: number; success: boolean }) =>
        prisma.parlayLeg.update({
          where: { id: v.legId },
          data: isProposer ? { proposerVote: v.success } : { opponentVote: v.success },
        })
      ),
    prisma.parlayVoteLog.create({ data: { parlayId, userId: user.id } }),
    prisma.parlay.update({ where: { id: parlayId }, data: { status: "voting" } }),
  ]);

  // Check if both players have now voted
  const voteCount = await prisma.parlayVoteLog.count({ where: { parlayId } });
  if (voteCount < 2) {
    return NextResponse.json({ ok: true, settled: false, waitingFor: "other player" });
  }

  // Both voted — resolve each leg (majority: if both agree use that, else proposer's vote wins)
  const updatedLegs = await prisma.parlayLeg.findMany({
    where: { parlayId, accepted: true },
    orderBy: { order: "asc" },
  });

  await prisma.$transaction(
    updatedLegs.map((leg) => {
      const result = leg.proposerVote === leg.opponentVote
        ? leg.proposerVote  // both agree
        : leg.proposerVote; // disagreement: proposer's vote is tiebreaker
      return prisma.parlayLeg.update({ where: { id: leg.id }, data: { result } });
    })
  );

  const resolvedLegs = await prisma.parlayLeg.findMany({
    where: { parlayId, accepted: true },
    orderBy: { order: "asc" },
  });

  // All active legs must succeed
  const allSucceeded = resolvedLegs.every((l) => l.result === true);
  const proposerWon = allSucceeded;

  // MONITOR cans for proposer — 1 can per successful leg regardless of overall outcome
  const MONITOR_PER_LEG: Record<number, number> = { 100: 1, 200: 2, 300: 3 };
  const successfulLegs = resolvedLegs.filter((l) => l.result === true).length;
  const proposerCans = successfulLegs * (MONITOR_PER_LEG[parlay.costPerLeg] ?? 1);

  // Fan Competition: 10% skim of net profit → fan pot; full net → fan score
  const proposerNet = proposerWon ? Math.max(0, parlay.payout - parlay.totalEscrowed) : 0;
  const opponentNet = proposerWon ? 0 : parlay.totalEscrowed;
  const proposerSkim = Math.floor(proposerNet * 0.10);
  const opponentSkim = Math.floor(opponentNet * 0.10);

  await prisma.$transaction(async (tx) => {
    await tx.parlay.update({
      where: { id: parlayId },
      data: { status: "settled", proposerWon, settledAt: new Date() },
    });

    if (proposerWon) {
      const effectivePayout = parlay.payout - proposerSkim;
      await tx.user.update({ where: { id: parlay.proposerId }, data: { points: { increment: effectivePayout } } });
      await logPoints(tx, parlay.proposerId, effectivePayout, `Parlay won — ${resolvedLegs.length} legs${proposerSkim > 0 ? ` (−${proposerSkim} fan pot)` : ""}`);
      if (proposerNet > 0) {
        await tx.worldCupEntry.update({ where: { userId: parlay.proposerId }, data: { fanScore: { increment: proposerNet } } });
        if (proposerSkim > 0) await tx.houseConfig.update({ where: { id: 1 }, data: { wcFanPot: { increment: proposerSkim } } });
      }
    } else {
      const effectivePayout = parlay.totalEscrowed - opponentSkim;
      await tx.user.update({ where: { id: parlay.opponentId }, data: { points: { increment: effectivePayout } } });
      await logPoints(tx, parlay.opponentId, effectivePayout, `Parlay failed — kept proposer's stake${opponentSkim > 0 ? ` (−${opponentSkim} fan pot)` : ""}`);
      if (opponentNet > 0) {
        await tx.worldCupEntry.update({ where: { userId: parlay.opponentId }, data: { fanScore: { increment: opponentNet } } });
        if (opponentSkim > 0) await tx.houseConfig.update({ where: { id: 1 }, data: { wcFanPot: { increment: opponentSkim } } });
      }
    }

    // Award MONITOR cans to proposer for each successful leg
    if (proposerCans > 0) {
      await tx.worldCupEntry.update({
        where: { userId: parlay.proposerId },
        data: { monitorCans: { increment: proposerCans } },
      });
    }
  });

  // ── Achievement checks (proposer only, one-time unlocks) ──────────────────

  // three_leg_machine: 3+ successful legs on a single parlay
  if (successfulLegs >= 3) {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: parlay.proposerId, achievementId: "three_leg_machine" } },
    });
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        await tx.userAchievement.create({ data: { userId: parlay.proposerId, achievementId: "three_leg_machine" } });
        await tx.worldCupEntry.update({
          where: { userId: parlay.proposerId },
          data: { monitorCans: { increment: 4 } },
        });
      });
    }
  }

  // clean_sweep: all 5 active legs hit
  if (resolvedLegs.length === 5 && allSucceeded) {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: parlay.proposerId, achievementId: "clean_sweep" } },
    });
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        await tx.userAchievement.create({ data: { userId: parlay.proposerId, achievementId: "clean_sweep" } });
        await tx.worldCupEntry.update({
          where: { userId: parlay.proposerId },
          data: { monitorCans: { increment: 10 } },
        });
        await tx.userItem.create({
          data: { userId: parlay.proposerId, itemType: "temp_vpn", usesLeft: 1 },
        });
      });
    }
  }

  return NextResponse.json({
    ok: true,
    settled: true,
    proposerWon,
    payout: proposerWon ? parlay.payout : 0,
    proposerCansEarned: proposerCans,
    legs: resolvedLegs.map((l) => ({ id: l.id, order: l.order, description: l.description, result: l.result })),
  });
}
