import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  const [shootoutLogs, reflexLogs, entries] = await Promise.all([
    prisma.worldCupGameLog.findMany({
      where: { gameType: "shootout" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.worldCupGameLog.findMany({
      where: { gameType: "reflex" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.worldCupEntry.findMany({
      include: { user: true, team: true },
    }),
  ]);

  const entryMap = new Map(entries.map((e) => [e.userId, e]));

  // Shootout standings
  const shootoutByUser = new Map<number, { plays: number; bestScore: number; totalCans: number }>();
  for (const log of shootoutLogs) {
    const prev = shootoutByUser.get(log.userId) ?? { plays: 0, bestScore: 0, totalCans: 0 };
    let score = 0;
    try { score = (JSON.parse(log.result) as { score: number }).score; } catch { /* skip */ }
    shootoutByUser.set(log.userId, {
      plays: prev.plays + 1,
      bestScore: Math.max(prev.bestScore, score),
      totalCans: prev.totalCans + log.cansEarned,
    });
  }

  // Reflex standings
  const reflexByUser = new Map<number, { plays: number; totalSaves: number; totalCans: number }>();
  for (const log of reflexLogs) {
    const prev = reflexByUser.get(log.userId) ?? { plays: 0, totalSaves: 0, totalCans: 0 };
    let saves = 0;
    try { saves = (JSON.parse(log.result) as { saves: number }).saves; } catch { /* skip */ }
    reflexByUser.set(log.userId, {
      plays: prev.plays + 1,
      totalSaves: prev.totalSaves + saves,
      totalCans: prev.totalCans + log.cansEarned,
    });
  }

  const shootout = [...shootoutByUser.entries()]
    .map(([userId, s]) => {
      const e = entryMap.get(userId);
      return {
        username: e?.user.username ?? "?",
        flag: e?.team.flag ?? "",
        ...s,
      };
    })
    .sort((a, b) => b.bestScore - a.bestScore || b.totalCans - a.totalCans);

  const reflex = [...reflexByUser.entries()]
    .map(([userId, r]) => {
      const e = entryMap.get(userId);
      const saveRate = r.plays > 0 ? Math.round((r.totalSaves / (r.plays * 5)) * 100) : 0;
      return {
        username: e?.user.username ?? "?",
        flag: e?.team.flag ?? "",
        saveRate,
        ...r,
      };
    })
    .sort((a, b) => b.saveRate - a.saveRate || b.totalCans - a.totalCans);

  return NextResponse.json({ shootout, reflex });
}
