import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import {
  ALL_ZONES,
  Zone,
  houseKeeperZones,
  cansForScore,
} from "@/lib/worldCupMiniGames";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  const playsToday = await prisma.worldCupGameLog.count({
    where: { userId: user.id, gameType: "shootout", createdAt: { gte: startOfToday() } },
  });

  // If already played, return last result
  if (playsToday >= 1) {
    const last = await prisma.worldCupGameLog.findFirst({
      where: { userId: user.id, gameType: "shootout" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      playsToday,
      limit: 1,
      zones: ALL_ZONES,
      alreadyPlayed: true,
      lastResult: last ? JSON.parse(last.result) : null,
      lastCans: last?.cansEarned ?? 0,
    });
  }

  return NextResponse.json({
    playsToday,
    limit: 1,
    zones: ALL_ZONES,
    alreadyPlayed: false,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  // Daily limit
  const playsToday = await prisma.worldCupGameLog.count({
    where: { userId: user.id, gameType: "shootout", createdAt: { gte: startOfToday() } },
  });
  if (playsToday >= 1) {
    return NextResponse.json({ error: "Already played today — come back tomorrow" }, { status: 429 });
  }

  const body = await req.json();
  const picks: Zone[] = body.picks;
  if (!Array.isArray(picks) || picks.length !== 5 || picks.some((z) => !ALL_ZONES.includes(z))) {
    return NextResponse.json({ error: "Send exactly 5 valid zone picks" }, { status: 400 });
  }

  // Get player's last scored zones so The House can bias the keeper
  const lastLog = await prisma.worldCupGameLog.findFirst({
    where: { userId: user.id, gameType: "shootout" },
    orderBy: { createdAt: "desc" },
  });

  let playerLastScoredZones: Zone[] = [];
  if (lastLog) {
    try {
      const prev = JSON.parse(lastLog.result) as { picks: Zone[]; keeperZones: Zone[] };
      playerLastScoredZones = prev.picks.filter((p, i) => p !== prev.keeperZones[i]);
    } catch { /* ignore parse error */ }
  }

  // House biases toward zones the player previously scored on
  const keeperZones = houseKeeperZones(playerLastScoredZones);

  const kicks = picks.map((pick, i) => ({
    pick,
    keeperZone: keeperZones[i],
    goal: pick !== keeperZones[i],
  }));
  const score = kicks.filter((k) => k.goal).length;
  const cansEarned = cansForScore(score);

  const result = { picks, keeperZones, score };

  await prisma.$transaction(async (tx) => {
    if (cansEarned > 0) {
      await tx.worldCupEntry.update({
        where: { userId: user.id },
        data: { monitorCans: { increment: cansEarned } },
      });
    }
    // Always save latest picks for opponents in Keeper's Reflex
    await tx.worldCupEntry.update({
      where: { userId: user.id },
      data: { lastShootoutPicks: JSON.stringify(picks) },
    });
    await tx.worldCupGameLog.create({
      data: {
        userId: user.id,
        gameType: "shootout",
        result: JSON.stringify(result),
        cansEarned,
      },
    });
    if (cansEarned > 0) {
      await logPoints(tx, user.id, 0, `World Cup Shootout — scored ${score}/5, earned ${cansEarned} 🥤`);
    }
  });

  return NextResponse.json({ kicks, score, cansEarned });
}
