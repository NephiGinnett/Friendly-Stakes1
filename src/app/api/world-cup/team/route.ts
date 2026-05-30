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
  if (!entry) return NextResponse.json({ error: "You haven't entered the World Cup event" }, { status: 404 });

  const [homeMatches, awayMatches] = await Promise.all([
    prisma.worldCupMatch.findMany({
      where: { homeTeamId: entry.teamId },
      orderBy: { kickoff: "asc" },
    }),
    prisma.worldCupMatch.findMany({
      where: { awayTeamId: entry.teamId },
      orderBy: { kickoff: "asc" },
    }),
  ]);

  const matches = [...homeMatches, ...awayMatches].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );

  const finished = matches.filter((m) => m.status === "FINISHED");
  const wins = finished.filter((m) =>
    (m.homeTeamId === entry.teamId && m.winner === "HOME_TEAM") ||
    (m.awayTeamId === entry.teamId && m.winner === "AWAY_TEAM")
  ).length;
  const draws = finished.filter((m) => m.winner === "DRAW").length;
  const losses = finished.length - wins - draws;

  const upcoming = matches.filter((m) => m.status === "SCHEDULED").slice(0, 3);
  const recent = finished.slice(-5);

  return NextResponse.json({
    team: entry.team,
    record: { played: finished.length, wins, draws, losses },
    upcoming,
    recent,
    allMatches: matches,
  });
}
