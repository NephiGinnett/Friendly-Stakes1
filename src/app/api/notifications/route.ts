import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bingoSeenAt = searchParams.get("bingoSeenAt");
  const seenDate = bingoSeenAt ? new Date(bingoSeenAt) : null;

  const [
    pendingTargeted,
    myVotingChallenges,
    myVotingWagers,
    unclaimedAchievements,
    adminBingo,
    latestBingoApproval,
    houseConfig,
    allDistributions,
    claimedDistributions,
  ] = await Promise.all([
    prisma.challenge.count({ where: { targetId: user.id, status: "pending" } }),

    prisma.challenge.findMany({
      where: { acceptedById: user.id, status: "voting" },
      select: { id: true, votes: { where: { userId: user.id }, select: { id: true } } },
    }),

    prisma.wager.findMany({
      where: {
        status: "voting",
        OR: [
          { creatorId: user.id },
          { entries: { some: { userId: user.id } } },
        ],
      },
      select: { id: true, votes: { where: { userId: user.id }, select: { id: true } } },
    }),

    prisma.userAchievement.count({ where: { userId: user.id, claimed: false } }),

    user.isAdmin
      ? prisma.bingoSquare.count({ where: { claimStatus: "pending" } })
      : Promise.resolve(0),

    prisma.bingoSquare.findFirst({
      where: {
        userId: user.id,
        claimStatus: "approved",
        ...(seenDate ? { claimedAt: { gt: seenDate } } : {}),
      },
      orderBy: { claimedAt: "desc" },
      select: { claimedAt: true },
    }),

    prisma.houseConfig.findUnique({ where: { id: 1 } }),

    prisma.adminDistribution.findMany({ select: { id: true } }),
    prisma.adminDistributionClaim.findMany({ where: { userId: user.id }, select: { distributionId: true } }),
  ]);

  const unvotedChallenges = myVotingChallenges.filter((c) => c.votes.length === 0).length;
  const unvotedWagers = myVotingWagers.filter((w) => w.votes.length === 0).length;
  const claimedIds = new Set(claimedDistributions.map((c) => c.distributionId));
  const pendingDistributions = allDistributions.filter((d) => !claimedIds.has(d.id)).length;

  return NextResponse.json({
    challenges: pendingTargeted + unvotedChallenges,
    wagers: unvotedWagers,
    achievements: unclaimedAchievements,
    adminBingo,
    bingo: latestBingoApproval?.claimedAt ?? null,
    boss: houseConfig?.bossActive ?? false,
    distributions: pendingDistributions,
  });
}
