import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { seedWorldCupTeams } from "@/lib/worldCupSeed";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await seedWorldCupTeams();

  const [config, teams, preEntry, takenEntries, realEntry] = await Promise.all([
    prisma.houseConfig.findUnique({ where: { id: 1 } }),
    prisma.worldCupTeam.findMany({ orderBy: [{ confederation: "asc" }, { name: "asc" }] }),
    prisma.worldCupPreEntry.findUnique({ where: { userId: user.id } }),
    prisma.worldCupEntry.findMany({ select: { teamId: true } }),
    prisma.worldCupEntry.findUnique({ where: { userId: user.id } }),
  ]);

  const playerLiveAt = config?.worldCupPlayerAt ?? null;
  const now = new Date();
  const isLive = !!(playerLiveAt && now >= playerLiveAt);

  return NextResponse.json({
    isLive,
    hasRealEntry: !!realEntry,
    playerLiveAt: playerLiveAt?.toISOString() ?? null,
    teams,
    takenTeamIds: takenEntries.map((e) => e.teamId),
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
