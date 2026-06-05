import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const ROUND_POINTS: Record<string, number> = {
  R32: 5, R16: 10, QF: 20, SF: 40, FINAL: 80,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [slots, picks, teams, config] = await Promise.all([
    prisma.bracketSlot.findMany({ orderBy: [{ round: "asc" }, { position: "asc" }] }),
    prisma.bracketPick.findMany({ where: { userId: user.id } }),
    prisma.worldCupTeam.findMany({ select: { code: true, name: true, flag: true } }),
    prisma.houseConfig.findUnique({ where: { id: 1 }, select: { bracketLockedAt: true } }),
  ]);

  const now = new Date();
  const locked = !!(config?.bracketLockedAt && now >= config.bracketLockedAt);

  // Compute score from picks vs actual slot winners
  let score = 0;
  for (const pick of picks) {
    const slot = slots.find(s => s.round === pick.round && s.position === pick.position);
    if (slot?.winnerCode && slot.winnerCode === pick.teamCode) {
      score += ROUND_POINTS[pick.round] ?? 0;
    }
  }

  return NextResponse.json({ slots, picks, teams, locked, score });
}
