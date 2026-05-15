import { prisma } from "@/lib/db";
import { logPoints } from "@/lib/pointLog";

// Call after decrementing a thumb use — unlocks Little Jack Horner at 4 total uses across all purchases
export async function checkThumbAchievement(userId: number) {
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: "little_jack_horner" } },
  });
  if (existing) return;

  // Count total thumb uses consumed = sum of (maxUses - usesLeft) across all thumb items
  const thumbItems = await prisma.userItem.findMany({
    where: { userId, itemType: "thumb" },
    select: { usesLeft: true },
  });
  const totalUsed = thumbItems.reduce((sum, i) => sum + (2 - i.usesLeft), 0);

  if (totalUsed >= 4) {
    await prisma.userAchievement.create({
      data: { userId, achievementId: "little_jack_horner" },
    });
  }
}

export async function doSettle(wagerId: number, winnerSide: string, method: string) {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { entries: true },
  });
  if (!wager) return;

  const totalPool =
    wager.creatorStake + wager.entries.reduce((sum, e) => sum + e.stake, 0);

  const forSide = [
    { userId: wager.creatorId, stake: wager.creatorStake },
    ...wager.entries.filter((e) => e.side === "for").map((e) => ({ userId: e.userId, stake: e.stake })),
  ];
  const againstSide = wager.entries
    .filter((e) => e.side === "against")
    .map((e) => ({ userId: e.userId, stake: e.stake }));

  const winners = winnerSide === "for" ? forSide : againstSide;
  const losers = winnerSide === "for" ? againstSide : forSide;

  if (winners.length === 0) return;

  const winnerTotalStake = winners.reduce((sum, w) => sum + w.stake, 0);
  const payouts = winners.map((w) => ({
    userId: w.userId,
    amount: Math.floor((w.stake / winnerTotalStake) * totalPool),
  }));

  const distributed = payouts.reduce((sum, p) => sum + p.amount, 0);
  payouts[0].amount += totalPool - distributed;

  await prisma.$transaction(async (tx) => {
    await tx.wager.update({
      where: { id: wagerId },
      data: { status: "settled", winnerSide, settledAt: new Date(), settledBy: method },
    });
    for (const p of payouts) {
      await tx.user.update({ where: { id: p.userId }, data: { points: { increment: p.amount } } });
      await logPoints(tx, p.userId, p.amount, `Won wager: ${wager.title}`);
    }
  });

  // Lone Wolf: sole winner against at least 2 opponents
  if (winners.length === 1 && losers.length >= 2) {
    const winnerId = winners[0].userId;
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: winnerId, achievementId: "lone_wolf" } },
    });
    if (!existing) {
      await prisma.userAchievement.create({
        data: { userId: winnerId, achievementId: "lone_wolf" },
      });
    }
  }
}
