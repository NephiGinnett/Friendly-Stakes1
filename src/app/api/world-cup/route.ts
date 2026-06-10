import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { seedWorldCupTeams } from "@/lib/worldCupSeed";
import { logPoints } from "@/lib/pointLog";

const ENTRY_COST = 500;

function getVisibility(config: { worldCupAdminAt: Date | null; worldCupPlayerAt: Date | null }, isAdmin: boolean) {
  const now = new Date();
  if (!config.worldCupAdminAt || !config.worldCupPlayerAt) return "hidden";
  if (now < config.worldCupAdminAt) return "hidden";
  if (isAdmin && now >= config.worldCupAdminAt) return "visible";
  if (now >= config.worldCupPlayerAt) return "visible";
  return "preview"; // admin-only preview window
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await seedWorldCupTeams();

  const [config, teams, entry, takenEntries, preEntry] = await Promise.all([
    prisma.houseConfig.findUnique({ where: { id: 1 } }),
    prisma.worldCupTeam.findMany({ orderBy: [{ confederation: "asc" }, { name: "asc" }] }),
    prisma.worldCupEntry.findUnique({ where: { userId: user.id }, include: { team: true } }),
    prisma.worldCupEntry.findMany({ select: { teamId: true } }),
    prisma.worldCupPreEntry.findUnique({ where: { userId: user.id }, select: { teamId: true } }),
  ]);

  const visibility = getVisibility(
    { worldCupAdminAt: config?.worldCupAdminAt ?? null, worldCupPlayerAt: config?.worldCupPlayerAt ?? null },
    user.isAdmin
  );

  return NextResponse.json({
    visibility,
    adminLiveAt: config?.worldCupAdminAt ?? null,
    playerLiveAt: config?.worldCupPlayerAt ?? null,
    eventEndAt: config?.worldCupEventEndAt ?? null,
    teams,
    takenTeamIds: takenEntries.map((e) => e.teamId),
    entry: entry ? { teamId: entry.teamId, team: entry.team, createdAt: entry.createdAt } : null,
    monitorCans: entry?.monitorCans ?? 0,
    preEntryTeamId: preEntry?.teamId ?? null,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await req.json();
  if (!teamId) return NextResponse.json({ error: "Team required" }, { status: 400 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  const visibility = getVisibility(
    { worldCupAdminAt: config?.worldCupAdminAt ?? null, worldCupPlayerAt: config?.worldCupPlayerAt ?? null },
    user.isAdmin
  );
  if (visibility === "hidden") return NextResponse.json({ error: "Event not yet open" }, { status: 403 });

  const existing = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (existing) return NextResponse.json({ error: "You've already entered" }, { status: 409 });

  const teamTaken = await prisma.worldCupEntry.findUnique({ where: { teamId } });
  if (teamTaken) return NextResponse.json({ error: "That team is already taken by another player" }, { status: 409 });

  const team = await prisma.worldCupTeam.findUnique({ where: { id: teamId } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (user.points < ENTRY_COST) return NextResponse.json({ error: "Not enough points (500 required)" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.worldCupEntry.create({ data: { userId: user.id, teamId, paid: ENTRY_COST } });
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: ENTRY_COST } } });
    await logPoints(tx, user.id, -ENTRY_COST, `World Cup 2026 entry — backing ${team.name}`);
  });

  return NextResponse.json({ ok: true, team });
}
