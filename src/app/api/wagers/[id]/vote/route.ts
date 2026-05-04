import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const MIN_VOTES_TO_SETTLE = 2;

async function doSettle(wagerId: number, winnerSide: string, method: string) {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { entries: true },
  });
  if (!wager) return;

  const totalPool =
    wager.creatorStake + wager.entries.reduce((sum, e) => sum + e.stake, 0);

  const winners: { userId: number; stake: number }[] = [];
  if (winnerSide === "for") {
    winners.push({ userId: wager.creatorId, stake: wager.creatorStake });
    wager.entries
      .filter((e) => e.side === "for")
      .forEach((e) => winners.push({ userId: e.userId, stake: e.stake }));
  } else {
    wager.entries
      .filter((e) => e.side === "against")
      .forEach((e) => winners.push({ userId: e.userId, stake: e.stake }));
  }

  if (winners.length === 0) return;

  const winnerTotalStake = winners.reduce((sum, w) => sum + w.stake, 0);
  const payouts = winners.map((w) => ({
    userId: w.userId,
    amount: Math.floor((w.stake / winnerTotalStake) * totalPool),
  }));

  const distributed = payouts.reduce((sum, p) => sum + p.amount, 0);
  payouts[0].amount += totalPool - distributed;

  await prisma.$transaction([
    prisma.wager.update({
      where: { id: wagerId },
      data: { status: "settled", winnerSide, settledAt: new Date(), settledBy: method },
    }),
    ...payouts.map((p) =>
      prisma.user.update({
        where: { id: p.userId },
        data: { points: { increment: p.amount } },
      })
    ),
  ]);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { choice } = await req.json();
    const wagerId = parseInt(params.id);

    if (choice !== "for" && choice !== "against") {
      return NextResponse.json({ error: "Choice must be 'for' or 'against'" }, { status: 400 });
    }

    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { votes: true },
    });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "voting") {
      return NextResponse.json({ error: "Wager is not open for voting" }, { status: 400 });
    }

    await prisma.vote.upsert({
      where: { wagerId_userId: { wagerId, userId: user.id } },
      create: { wagerId, userId: user.id, choice },
      update: { choice },
    });

    const allVotes = await prisma.vote.findMany({ where: { wagerId } });

    if (allVotes.length >= MIN_VOTES_TO_SETTLE) {
      const forVotes = allVotes.filter((v) => v.choice === "for").length;
      const againstVotes = allVotes.filter((v) => v.choice === "against").length;

      if (forVotes > againstVotes && forVotes > allVotes.length / 2) {
        await doSettle(wagerId, "for", "vote");
      } else if (againstVotes > forVotes && againstVotes > allVotes.length / 2) {
        await doSettle(wagerId, "against", "vote");
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
