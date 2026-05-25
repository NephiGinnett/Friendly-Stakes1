import { prisma } from "@/lib/db";
import { logPoints } from "@/lib/pointLog";
import { updateBotPersonalityResults, computeLockedPayout } from "@/lib/publicWagerBots";

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
    include: { entries: true, botEntries: true },
  });
  if (!wager) return;

  const botPool = wager.botEntries.reduce((sum, b) => sum + b.stake, 0);
  const totalPool = wager.creatorStake + wager.entries.reduce((sum, e) => sum + e.stake, 0) + botPool;

  const forSide = [
    { userId: wager.creatorId, stake: wager.creatorStake, lockedPayout: wager.creatorLockedPayout },
    ...wager.entries.filter((e) => e.side === "for").map((e) => ({ userId: e.userId, stake: e.stake, lockedPayout: e.lockedPayout })),
  ];
  const againstSide = wager.entries
    .filter((e) => e.side === "against")
    .map((e) => ({ userId: e.userId, stake: e.stake, lockedPayout: e.lockedPayout }));

  // For public wagers the creator's payout uses final odds at close, not locked-in at creation
  if (wager.isPublic) {
    const finalForPool = wager.creatorStake
      + wager.entries.filter((e) => e.side === "for").reduce((s, e) => s + e.stake, 0)
      + wager.botEntries.filter((b) => b.side === "for").reduce((s, b) => s + b.stake, 0);
    const finalAgainstPool = wager.entries.filter((e) => e.side === "against").reduce((s, e) => s + e.stake, 0)
      + wager.botEntries.filter((b) => b.side === "against").reduce((s, b) => s + b.stake, 0);
    forSide[0].lockedPayout = computeLockedPayout(wager.creatorStake, finalForPool, finalAgainstPool);
  }

  const winners = winnerSide === "for" ? forSide : againstSide;
  const losers = winnerSide === "for" ? againstSide : forSide;

  if (winners.length === 0) return;

  let payouts: { userId: number; amount: number }[];

  if (wager.isPublic) {
    // Public wager: always pay full locked odds-based payout regardless of pool size.
    // The public absorbs any shortfall — this is a fixed-odds sportsbook model, not parimutuel.
    const totalLocked = winners.reduce((sum, w) => sum + w.lockedPayout, 0);
    if (totalLocked === 0) {
      payouts = computeProportionalPayouts(winners, totalPool);
    } else {
      payouts = winners.map((w) => ({ userId: w.userId, amount: w.lockedPayout }));
    }
  } else {
    payouts = computeProportionalPayouts(winners, totalPool);
  }

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

  // Update public wager win/loss stats for all real participants
  if (wager.isPublic) {
    const allRealPlayers = [
      { userId: wager.creatorId, side: "for" as const },
      ...wager.entries.map((e) => ({ userId: e.userId, side: e.side as "for" | "against" })),
    ];
    for (const player of allRealPlayers) {
      const won = player.side === winnerSide;
      await prisma.user.update({
        where: { id: player.userId },
        data: {
          publicWagerCount: { increment: 1 },
          ...(won ? { publicWagerWins: { increment: 1 } } : {}),
        },
      });
    }
    // Update bot personality records
    await updateBotPersonalityResults(wagerId, winnerSide);
  }

  // Lone Wolf: sole winner against at least 2 opponents (count bots as opponents too for public wagers)
  const loserCount = losers.length + (wager.isPublic ? wager.botEntries.filter((b) => b.side !== winnerSide).length : 0);
  if (winners.length === 1 && loserCount >= 2) {
    const winnerId = winners[0].userId;
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: winnerId, achievementId: "lone_wolf" } },
    });
    if (!existing) {
      await prisma.userAchievement.create({ data: { userId: winnerId, achievementId: "lone_wolf" } });
    }
  }

  // Ghost Bet: net profit > 500 pts in a single wager (one-time unlock)
  const stakeMap = new Map(winners.map((w) => [w.userId, w.stake]));
  for (const payout of payouts) {
    const stake = stakeMap.get(payout.userId) ?? 0;
    if (payout.amount - stake > 500) {
      const existing = await prisma.userAchievement.findUnique({
        where: { userId_achievementId: { userId: payout.userId, achievementId: "ghost_bet" } },
      });
      if (!existing) {
        await prisma.userAchievement.create({ data: { userId: payout.userId, achievementId: "ghost_bet" } });
      }
    }
  }
}

function computeProportionalPayouts(winners: { userId: number; stake: number }[], totalPool: number) {
  const winnerTotalStake = winners.reduce((sum, w) => sum + w.stake, 0);
  const payouts = winners.map((w) => ({
    userId: w.userId,
    amount: Math.floor((w.stake / winnerTotalStake) * totalPool),
  }));
  const distributed = payouts.reduce((sum, p) => sum + p.amount, 0);
  if (payouts.length > 0) payouts[0].amount += totalPool - distributed;
  return payouts;
}
