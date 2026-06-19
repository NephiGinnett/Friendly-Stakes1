import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function buildTeamData(matches: Array<{ status: string; homeTeamId: number | null; awayTeamId: number | null; winner: string | null; kickoff: Date }>, teamId: number) {
  const sorted = [...matches].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const finished = sorted.filter((m) => m.status === "FINISHED");
  const wins = finished.filter((m) =>
    (m.homeTeamId === teamId && m.winner === "HOME_TEAM") ||
    (m.awayTeamId === teamId && m.winner === "AWAY_TEAM")
  ).length;
  const draws = finished.filter((m) => m.winner === "DRAW").length;
  const losses = finished.length - wins - draws;
  return {
    record: { played: finished.length, wins, draws, losses },
    upcoming: sorted.filter((m) => m.status === "SCHEDULED").slice(0, 3),
    recent: finished.slice(-5),
    allMatches: sorted,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true, proxyTeam: true },
  });
  if (!entry) return NextResponse.json({ error: "You haven't entered the World Cup event" }, { status: 404 });

  const [homeMatches, awayMatches] = await Promise.all([
    prisma.worldCupMatch.findMany({ where: { homeTeamId: entry.teamId }, orderBy: { kickoff: "asc" } }),
    prisma.worldCupMatch.findMany({ where: { awayTeamId: entry.teamId }, orderBy: { kickoff: "asc" } }),
  ]);
  const matches = [...homeMatches, ...awayMatches];
  const teamData = buildTeamData(matches, entry.teamId);

  let proxyData = null;
  if (entry.proxyTeam && entry.proxyTeamId) {
    const [proxyHome, proxyAway] = await Promise.all([
      prisma.worldCupMatch.findMany({ where: { homeTeamId: entry.proxyTeamId }, orderBy: { kickoff: "asc" } }),
      prisma.worldCupMatch.findMany({ where: { awayTeamId: entry.proxyTeamId }, orderBy: { kickoff: "asc" } }),
    ]);
    const proxyMatches = [...proxyHome, ...proxyAway];
    proxyData = {
      team: entry.proxyTeam,
      ...buildTeamData(proxyMatches, entry.proxyTeamId),
    };
  }

  return NextResponse.json({
    team: entry.team,
    ...teamData,
    proxy: proxyData,
  });
}
