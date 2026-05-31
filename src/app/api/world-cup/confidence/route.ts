import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true },
  });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  // Next scheduled match for this player's team
  const nextMatch = await prisma.worldCupMatch.findFirst({
    where: {
      status: "SCHEDULED",
      OR: [{ homeTeamId: entry.teamId }, { awayTeamId: entry.teamId }],
    },
    orderBy: { kickoff: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  // Players backing the opposing team in that match
  let opponents: { username: string; flag: string; confidenceStake: number }[] = [];
  if (nextMatch) {
    const opposingTeamId = nextMatch.homeTeamId === entry.teamId
      ? nextMatch.awayTeamId
      : nextMatch.homeTeamId;
    if (opposingTeamId) {
      const opponentEntries = await prisma.worldCupEntry.findMany({
        where: { teamId: opposingTeamId },
        include: { user: { select: { username: true } }, team: true },
      });
      opponents = opponentEntries.map((e) => ({
        username: e.user.username,
        flag: e.team.flag,
        confidenceStake: e.confidenceStake,
      }));
    }
  }

  // Past settled wagers
  const history = await prisma.confidenceWager.findMany({
    where: { OR: [{ winnerId: user.id }, { loserId: user.id }] },
    orderBy: { settledAt: "desc" },
    take: 10,
    include: {
      winner: { select: { username: true } },
      loser: { select: { username: true } },
      match: { select: { homeTeamName: true, awayTeamName: true, stage: true, kickoff: true } },
    },
  });

  return NextResponse.json({
    myTeam: entry.team,
    confidenceStake: entry.confidenceStake,
    nextMatch,
    opponents,
    history,
  });
}

// Update the player's standing confidence stake
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stake } = await req.json();
  const stakeNum = Math.max(0, Math.min(parseInt(stake) || 100, user.points));

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  await prisma.worldCupEntry.update({
    where: { userId: user.id },
    data: { confidenceStake: stakeNum },
  });

  return NextResponse.json({ ok: true, confidenceStake: stakeNum });
}
