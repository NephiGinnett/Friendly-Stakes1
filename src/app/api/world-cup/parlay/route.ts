import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const MULTIPLIERS = [2, 3, 5, 8, 13]; // indexed by (activeLegCount - 1)
const MONITOR_PER_LEG = { 100: 1, 200: 2, 300: 3 } as Record<number, number>;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true, proxyTeam: true },
  });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  const effectiveTeamId = entry.proxyTeamId ?? entry.teamId;

  // Next match for this player's effective team
  const nextMatch = await prisma.worldCupMatch.findFirst({
    where: {
      status: { in: ["SCHEDULED", "TIMED"] },
      OR: [{ homeTeamId: effectiveTeamId }, { awayTeamId: effectiveTeamId }],
    },
    orderBy: { kickoff: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  const now = new Date();
  const twoHoursBefore = nextMatch
    ? new Date(new Date(nextMatch.kickoff).getTime() - 2 * 60 * 60 * 1000)
    : null;
  const oneHourBefore = nextMatch
    ? new Date(new Date(nextMatch.kickoff).getTime() - 1 * 60 * 60 * 1000)
    : null;

  // Find the opposing team's player with the highest confidence stake
  const opposingTeamId = nextMatch
    ? nextMatch.homeTeamId === effectiveTeamId ? nextMatch.awayTeamId : nextMatch.homeTeamId
    : null;

  let opponent: { userId: number; username: string; confidenceStake: number } | null = null;
  if (opposingTeamId) {
    const oppEntry = await prisma.worldCupEntry.findFirst({
      where: { OR: [{ teamId: opposingTeamId ?? -1 }, { proxyTeamId: opposingTeamId ?? -1 }] },
      orderBy: { confidenceStake: "desc" },
      include: { user: { select: { id: true, username: true } } },
    });
    if (oppEntry) opponent = { userId: oppEntry.userId, username: oppEntry.user.username, confidenceStake: oppEntry.confidenceStake };
  }

  // Determine if this player can propose (higher confidence stake, within proposal window)
  const canPropose = !!(
    nextMatch &&
    opponent &&
    entry.confidenceStake > opponent.confidenceStake &&
    twoHoursBefore && now >= twoHoursBefore &&
    oneHourBefore && now < oneHourBefore
  );

  // Existing parlay for this match (as proposer or opponent)
  const existingParlay = nextMatch
    ? await prisma.parlay.findFirst({
        where: {
          matchId: nextMatch.id,
          OR: [{ proposerId: user.id }, { opponentId: user.id }],
          status: { not: "cancelled" },
        },
        include: {
          legs: { orderBy: { order: "asc" } },
          proposer: { select: { id: true, username: true } },
          opponent: { select: { id: true, username: true } },
        },
      })
    : null;

  // Past parlays
  const history = await prisma.parlay.findMany({
    where: {
      OR: [{ proposerId: user.id }, { opponentId: user.id }],
      status: "settled",
    },
    orderBy: { settledAt: "desc" },
    take: 10,
    include: {
      legs: { orderBy: { order: "asc" } },
      proposer: { select: { id: true, username: true } },
      opponent: { select: { id: true, username: true } },
      match: { select: { homeTeamName: true, awayTeamName: true, stage: true } },
    },
  });

  return NextResponse.json({
    myTeam: entry.proxyTeam ?? entry.team,
    isProxy: !!entry.proxyTeamId,
    confidenceStake: entry.confidenceStake,
    monitorCans: entry.monitorCans,
    nextMatch,
    opponent,
    canPropose,
    proposalDeadline: oneHourBefore,
    existingParlay,
    history,
    multipliers: MULTIPLIERS,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId, costPerLeg, legs } = await req.json();
  // legs: { order: number; description: string }[]

  if (![100, 200, 300].includes(costPerLeg)) {
    return NextResponse.json({ error: "Cost per leg must be 100, 200, or 300" }, { status: 400 });
  }
  if (!Array.isArray(legs) || legs.length < 1 || legs.length > 5) {
    return NextResponse.json({ error: "1–5 legs required" }, { status: 400 });
  }
  if (legs.some((l: { description: string }) => !l.description?.trim())) {
    return NextResponse.json({ error: "All legs need a description" }, { status: 400 });
  }

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true },
  });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  const effectiveTeamId = entry.proxyTeamId ?? entry.teamId;

  const match = await prisma.worldCupMatch.findUnique({ where: { id: matchId } });
  if (!match || match.status !== "SCHEDULED") {
    return NextResponse.json({ error: "Match not available" }, { status: 400 });
  }

  const now = new Date();
  const twoHoursBefore = new Date(new Date(match.kickoff).getTime() - 2 * 60 * 60 * 1000);
  const oneHourBefore = new Date(new Date(match.kickoff).getTime() - 1 * 60 * 60 * 1000);
  if (now < twoHoursBefore || now >= oneHourBefore) {
    return NextResponse.json({ error: "Parlay window is 2h–1h before kickoff" }, { status: 400 });
  }

  // Verify proposer's effective team is in this match
  const isHome = match.homeTeamId === effectiveTeamId;
  const isAway = match.awayTeamId === effectiveTeamId;
  if (!isHome && !isAway) return NextResponse.json({ error: "Your team is not in this match" }, { status: 400 });

  // Find opponent with highest confidence stake backing the other team
  const opposingTeamId = isHome ? match.awayTeamId : match.homeTeamId;
  const oppEntry = await prisma.worldCupEntry.findFirst({
    where: { OR: [{ teamId: opposingTeamId ?? -1 }, { proxyTeamId: opposingTeamId ?? -1 }] },
    orderBy: { confidenceStake: "desc" },
    include: { user: { select: { id: true } } },
  });
  if (!oppEntry) return NextResponse.json({ error: "No opponent backing the other team" }, { status: 400 });
  if (entry.confidenceStake <= oppEntry.confidenceStake) {
    return NextResponse.json({ error: "Only the player with the higher confidence stake can propose" }, { status: 403 });
  }

  // Check no existing parlay for this match
  const existing = await prisma.parlay.findFirst({
    where: { matchId, OR: [{ proposerId: user.id }, { opponentId: user.id }], status: { not: "cancelled" } },
  });
  if (existing) return NextResponse.json({ error: "A parlay already exists for this match" }, { status: 409 });

  const totalEscrowed = costPerLeg * legs.length;
  if (user.points < totalEscrowed) {
    return NextResponse.json({ error: `Not enough points (need ${totalEscrowed})` }, { status: 400 });
  }

  const parlay = await prisma.$transaction(async (tx) => {
    const p = await tx.parlay.create({
      data: {
        matchId,
        proposerId: user.id,
        opponentId: oppEntry.userId,
        costPerLeg,
        totalEscrowed,
        status: "pending",
        legs: {
          create: legs.map((l: { order: number; description: string }) => ({
            order: l.order,
            description: l.description.trim(),
          })),
        },
      },
      include: { legs: { orderBy: { order: "asc" } } },
    });
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: totalEscrowed } } });
    await logPoints(tx, user.id, -totalEscrowed, `Parlay escrowed — ${legs.length} legs @ ${costPerLeg} pts`);
    return p;
  });

  return NextResponse.json({ ok: true, parlayId: parlay.id });
}
