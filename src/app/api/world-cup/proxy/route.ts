import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const PROXY_COST = 250;

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
    proxyEliminated: entry.proxyTeam?.eliminated ?? false,
    proxyCost: PROXY_COST,
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

  let proxyTeamName = "proxy team";
  if (teamId) {
    const team = await prisma.worldCupTeam.findUnique({ where: { id: teamId } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.eliminated) return NextResponse.json({ error: "Cannot proxy an eliminated team" }, { status: 400 });
    if (team.id === entry.teamId) return NextResponse.json({ error: "That's your original team" }, { status: 400 });
    proxyTeamName = team.name;
  }

  const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!freshUser || freshUser.points < PROXY_COST) {
    return NextResponse.json({ error: `Not enough points (${PROXY_COST} required to back a proxy)` }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.worldCupEntry.update({
      where: { userId: user.id },
      data: { proxyTeamId: teamId ?? null, proxyPaid: { increment: PROXY_COST } },
    });
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: PROXY_COST } } });
    await logPoints(tx, user.id, -PROXY_COST, `World Cup proxy entry — backing ${proxyTeamName}`);
  });

  return NextResponse.json({ ok: true, charged: PROXY_COST });
}
