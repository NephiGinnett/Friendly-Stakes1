import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true, proxyTeam: true },
  });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  const availableTeams = await prisma.worldCupTeam.findMany({
    where: { eliminated: false, id: { not: entry.teamId } },
    orderBy: [{ confederation: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    myTeam: entry.team,
    eliminated: entry.team.eliminated,
    proxyTeam: entry.proxyTeam ?? null,
    availableTeams,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await req.json();

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true },
  });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });
  if (!entry.team.eliminated) return NextResponse.json({ error: "Your team hasn't been eliminated" }, { status: 400 });

  if (teamId) {
    const team = await prisma.worldCupTeam.findUnique({ where: { id: teamId } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.eliminated) return NextResponse.json({ error: "Cannot proxy an eliminated team" }, { status: 400 });
    if (team.id === entry.teamId) return NextResponse.json({ error: "That's your original team" }, { status: 400 });
  }

  await prisma.worldCupEntry.update({
    where: { userId: user.id },
    data: { proxyTeamId: teamId ?? null },
  });

  return NextResponse.json({ ok: true });
}
