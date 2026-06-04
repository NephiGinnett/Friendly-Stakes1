import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { GAME_REGISTRY } from "@/lib/gameRegistry";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") ?? "";

  const game = GAME_REGISTRY[gameId as keyof typeof GAME_REGISTRY];
  if (!game) return NextResponse.json({ error: "Unknown game" }, { status: 400 });

  const sessions = await prisma.gameSession.findMany({
    where: { gameId, endedAt: { not: null } },
    select: {
      userId: true,
      metadata: true,
      pointsEarned: true,
      user: { select: { username: true } },
    },
  });

  const metric = game.leaderboardMetric;

  type Row = {
    userId: number;
    username: string;
    bestMetric: number;
    totalPts: number;
    runs: number;
  };

  const byUser = new Map<number, Row>();
  for (const s of sessions) {
    let val = 0;
    try { val = (JSON.parse(s.metadata || "{}")[metric] as number) ?? 0; } catch { /* ignore */ }

    const prev = byUser.get(s.userId);
    if (!prev) {
      byUser.set(s.userId, {
        userId: s.userId,
        username: s.user.username,
        bestMetric: val,
        totalPts: s.pointsEarned,
        runs: 1,
      });
    } else {
      prev.bestMetric = Math.max(prev.bestMetric, val);
      prev.totalPts += s.pointsEarned;
      prev.runs += 1;
    }
  }

  const ranked = Array.from(byUser.values())
    .sort((a, b) => b.bestMetric - a.bestMetric || b.totalPts - a.totalPts)
    .slice(0, 50)
    .map((r, i) => ({ ...r, rank: i + 1, isMe: r.userId === user.id }));

  return NextResponse.json({ rows: ranked, game: { leaderboardLabel: game.leaderboardLabel, leaderboardUnit: game.leaderboardUnit } });
}
