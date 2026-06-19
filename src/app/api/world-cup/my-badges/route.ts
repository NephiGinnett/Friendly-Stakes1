import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: {
      team: { select: { id: true, name: true, flag: true, code: true } },
      proxyTeam: { select: { id: true, name: true, flag: true, code: true } },
    },
  });

  if (!entry) return NextResponse.json({ team: null, proxy: null });

  const teamEliminated = await prisma.worldCupTeam.findUnique({
    where: { id: entry.teamId },
    select: { eliminated: true },
  });

  const proxyEliminated = entry.proxyTeamId
    ? await prisma.worldCupTeam.findUnique({
        where: { id: entry.proxyTeamId },
        select: { eliminated: true },
      })
    : null;

  return NextResponse.json({
    team: entry.team
      ? { ...entry.team, eliminated: teamEliminated?.eliminated ?? false }
      : null,
    proxy: entry.proxyTeam
      ? { ...entry.proxyTeam, eliminated: proxyEliminated?.eliminated ?? false }
      : null,
  });
}
