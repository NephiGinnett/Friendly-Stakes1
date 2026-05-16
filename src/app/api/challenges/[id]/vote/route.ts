import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkThumbAchievement } from "@/lib/settle";
import { logPoints } from "@/lib/pointLog";

const CHALLENGE_FEE = 50;
const BARON_RATE = 0.15;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { choice, useThumb } = await req.json();
    if (choice !== "completed" && choice !== "incomplete") {
      return NextResponse.json({ error: "Choice must be 'completed' or 'incomplete'" }, { status: 400 });
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id: parseInt(params.id) },
      include: { votes: true },
    });
    if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (challenge.status !== "voting") return NextResponse.json({ error: "Not in voting phase" }, { status: 400 });
    const isInvolved = user.id === challenge.creatorId || user.id === challenge.acceptedById;
    if (!isInvolved) {
      return NextResponse.json({ error: "Only the two players involved in this challenge can vote." }, { status: 403 });
    }
    if (challenge.votes.find((v) => v.userId === user.id)) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }

    let weight = 1;
    if (useThumb) {
      const thumbItem = await prisma.userItem.findFirst({
        where: { userId: user.id, itemType: "thumb", usesLeft: { gt: 0 } },
      });
      if (thumbItem) {
        weight = 2;
        await prisma.userItem.update({ where: { id: thumbItem.id }, data: { usesLeft: { decrement: 1 } } });
        await checkThumbAchievement(user.id);
      }
    }

    await prisma.challengeVote.create({
      data: { challengeId: challenge.id, userId: user.id, choice, weight },
    });

    // Check for auto-settle: 2+ weighted votes on one side
    const allVotes = [...challenge.votes, { choice, weight }];
    const completedW = allVotes.filter((v) => v.choice === "completed").reduce((s, v) => s + v.weight, 0);
    const incompleteW = allVotes.filter((v) => v.choice === "incomplete").reduce((s, v) => s + v.weight, 0);

    if (completedW >= 2 || incompleteW >= 2) {
      const taskCompleted = completedW >= 2;

      if (taskCompleted && challenge.acceptedById) {
        // Acceptor wins — pay out (offer - fee) * multiplier, minus Baron tax
        const basePayout = (challenge.offer - CHALLENGE_FEE) * challenge.multiplier;

        // All Barons except the winner themselves
        const baronRecords = await prisma.userAchievement.findMany({
          where: {
            achievementId: "baron",
            userId: { not: challenge.acceptedById },
          },
          include: { user: { select: { id: true } } },
        });

        const numBarons = baronRecords.length;
        const baronPool = numBarons > 0 ? Math.floor(basePayout * BARON_RATE) : 0;
        const perBaron = numBarons > 0 ? Math.floor(baronPool / numBarons) : 0;
        const winnerPayout = basePayout - baronPool;

        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: challenge.acceptedById! }, data: { points: { increment: winnerPayout } } });
          await logPoints(tx, challenge.acceptedById!, winnerPayout, `Completed bounty: "${challenge.title}"`);
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
      } else {
        // Task not completed — refund full offer to creator
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: challenge.creatorId }, data: { points: { increment: challenge.offer } } });
          await logPoints(tx, challenge.creatorId, challenge.offer, `Bounty refunded (not completed): "${challenge.title}"`);
          await tx.challenge.update({
            where: { id: challenge.id },
            data: { status: "settled", winnerUserId: challenge.creatorId, settledAt: new Date() },
          });
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
