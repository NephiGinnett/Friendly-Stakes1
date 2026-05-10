import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Challenges targeted at me that are still pending
  const pendingTargeted = await prisma.challenge.count({
    where: { targetId: user.id, status: "pending" },
  });

  // Challenges I accepted that are in voting and I haven't voted yet
  const myVotingChallenges = await prisma.challenge.findMany({
    where: { acceptedById: user.id, status: "voting" },
    select: { id: true, votes: { where: { userId: user.id }, select: { id: true } } },
  });
  const unvotedChallenges = myVotingChallenges.filter((c) => c.votes.length === 0).length;

  // Wagers I'm in that are in voting and I haven't voted yet
  const myVotingWagers = await prisma.wager.findMany({
    where: {
      status: "voting",
      OR: [
        { creatorId: user.id },
        { entries: { some: { userId: user.id } } },
      ],
    },
    select: { id: true, votes: { where: { userId: user.id }, select: { id: true } } },
  });
  const unvotedWagers = myVotingWagers.filter((w) => w.votes.length === 0).length;

  return NextResponse.json({
    challenges: pendingTargeted + unvotedChallenges,
    wagers: unvotedWagers,
  });
}
