import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const UPCOMING_STATUSES = ["SCHEDULED", "TIMED"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true, proxyTeam: true },
  });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  if (entry.team.eliminated) {
    return NextResponse.json({ eliminated: true, myTeam: entry.team });
  }

  async function getTeamData(teamId: number) {
    const nextMatch = await prisma.worldCupMatch.findFirst({
      where: {
        status: { in: UPCOMING_STATUSES },
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      orderBy: { kickoff: "asc" },
      include: { homeTeam: true, awayTeam: true },
    });

    let opponents: { username: string; flag: string; confidenceStake: number }[] = [];
    if (nextMatch) {
      const opposingTeamId = nextMatch.homeTeamId === teamId
        ? nextMatch.awayTeamId
        : nextMatch.homeTeamId;
      if (opposingTeamId) {
        const opponentEntries = await prisma.worldCupEntry.findMany({
          where: { OR: [{ teamId: opposingTeamId }, { proxyTeamId: opposingTeamId }] },
          include: { user: { select: { username: true } }, team: true },
        });
        opponents = opponentEntries.map((e) => ({
          username: e.user.username,
          flag: e.team.flag,
          confidenceStake: e.confidenceStake,
        }));
      }
    }
    return { nextMatch, opponents };
  }

  const primary = await getTeamData(entry.teamId);

  let proxy = null;
  if (entry.proxyTeam && entry.proxyTeamId && !entry.proxyTeam.eliminated) {
    const proxyData = await getTeamData(entry.proxyTeamId);
    proxy = { team: entry.proxyTeam, ...proxyData };
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
    proxyConfidenceStake: entry.proxyConfidenceStake,
    nextMatch: primary.nextMatch,
    opponents: primary.opponents,
    proxy,
    history,
  });
}

// Update the player's standing confidence stake
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stake, target } = await req.json();
  const stakeNum = Math.max(0, Math.min(parseInt(stake) || 0, user.points));
  const isProxy = target === "proxy";

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id }, include: { team: true, proxyTeam: true } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  if (isProxy) {
    if (!entry.proxyTeamId) return NextResponse.json({ error: "No proxy team selected" }, { status: 400 });
    if (entry.proxyTeam?.eliminated) return NextResponse.json({ error: "Your proxy team was eliminated" }, { status: 403 });
    await prisma.worldCupEntry.update({
      where: { userId: user.id },
      data: { proxyConfidenceStake: stakeNum },
    });
    return NextResponse.json({ ok: true, proxyConfidenceStake: stakeNum });
  }

  if (entry.team.eliminated) return NextResponse.json({ error: "Confidence wagers not available — your team was eliminated" }, { status: 403 });

  await prisma.worldCupEntry.update({
    where: { userId: user.id },
    data: { confidenceStake: stakeNum },
  });

  return NextResponse.json({ ok: true, confidenceStake: stakeNum });
}
