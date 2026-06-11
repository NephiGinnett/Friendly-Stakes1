import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { seedWorldCupTeams } from "@/lib/worldCupSeed";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await seedWorldCupTeams();

  const [config, teams, preEntry, takenRealEntries, takenPreEntries, realEntry] = await Promise.all([
    prisma.houseConfig.findUnique({ where: { id: 1 } }),
    prisma.worldCupTeam.findMany({ orderBy: [{ confederation: "asc" }, { name: "asc" }] }),
    prisma.worldCupPreEntry.findUnique({ where: { userId: user.id } }),
    prisma.worldCupEntry.findMany({ select: { teamId: true } }),
    // Other players' pre-registrations — exclude current user so their own pick isn't grayed out
    prisma.worldCupPreEntry.findMany({ where: { userId: { not: user.id }, teamId: { not: null } }, select: { teamId: true } }),
    prisma.worldCupEntry.findUnique({ where: { userId: user.id } }),
  ]);

  const playerLiveAt = config?.worldCupPlayerAt ?? null;
  const now = new Date();
  const isLive = !!(playerLiveAt && now >= playerLiveAt);

  const takenTeamIds = [
    ...takenRealEntries.map((e) => e.teamId),
    ...takenPreEntries.map((e) => e.teamId as number),
  ];

  return NextResponse.json({
    isLive,
    hasRealEntry: !!realEntry,
    playerLiveAt: playerLiveAt?.toISOString() ?? null,
    teams,
    takenTeamIds,
    preEntry: preEntry
      ? { teamId: preEntry.teamId, championPickId: preEntry.championPickId, runnerUpPickId: preEntry.runnerUpPickId }
      : null,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, championPickId, runnerUpPickId } = await req.json();

  const realEntry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (realEntry) return NextResponse.json({ error: "You're already entered in the event" }, { status: 409 });

  // If changing to a new team, check it isn't already reserved by someone else
  if (teamId) {
    const conflictReal = await prisma.worldCupEntry.findUnique({ where: { teamId } });
    const conflictPre = await prisma.worldCupPreEntry.findFirst({ where: { teamId, userId: { not: user.id } } });
    if (conflictReal || conflictPre) {
      return NextResponse.json({ error: "That team has already been claimed by another player" }, { status: 409 });
    }
  }

  await prisma.worldCupPreEntry.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      teamId: teamId ?? null,
      championPickId: championPickId ?? null,
      runnerUpPickId: runnerUpPickId ?? null,
    },
    update: {
      teamId: teamId ?? null,
      championPickId: championPickId ?? null,
      runnerUpPickId: runnerUpPickId ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
