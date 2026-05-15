import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function categorize(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("house spin") || r.includes("spin:")) return "Spin Wheel";
  if (r.includes("blackjack")) return "Blackjack";
  if (r.includes("wager") || r.includes("bet")) return "Wagers";
  if (r.includes("bingo") || r.includes("blackout")) return "Bingo";
  if (r.includes("achievement")) return "Achievements";
  if (r.includes("challenge")) return "Challenges";
  if (r.includes("the house erased") || r.includes("boss attack")) return "The House";
  if (r.includes("admin") || r.includes("adjust")) return "Admin";
  if (r.includes("donation") || r.includes("donate") || r.includes("be cou") || r.includes("st sins")) return "Donations";
  return "Other";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const [allLogs, allUsers] = await Promise.all([
    prisma.pointLog.findMany({ include: { user: { select: { username: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ select: { id: true, username: true, points: true }, orderBy: { points: "desc" } }),
  ]);

  let totalIn = 0;
  let totalOut = 0;
  const byCategory: Record<string, { in: number; out: number }> = {};
  const byPlayer: Record<string, { received: number; lost: number; net: number }> = {};

  for (const l of allLogs) {
    const cat = categorize(l.reason);
    const name = l.user.username;
    byCategory[cat] = byCategory[cat] ?? { in: 0, out: 0 };
    byPlayer[name] = byPlayer[name] ?? { received: 0, lost: 0, net: 0 };

    if (l.amount > 0) {
      totalIn += l.amount;
      byCategory[cat].in += l.amount;
      byPlayer[name].received += l.amount;
    } else {
      totalOut += Math.abs(l.amount);
      byCategory[cat].out += Math.abs(l.amount);
      byPlayer[name].lost += Math.abs(l.amount);
    }
    byPlayer[name].net += l.amount;
  }

  const circulatingTotal = allUsers.reduce((s, u) => s + u.points, 0);

  return NextResponse.json({
    totalIn,
    totalOut,
    circulatingTotal,
    byCategory: Object.entries(byCategory)
      .map(([cat, v]) => ({ cat, ...v, net: v.in - v.out }))
      .sort((a, b) => b.in - a.in),
    byPlayer: Object.entries(byPlayer)
      .map(([username, v]) => ({ username, ...v }))
      .sort((a, b) => b.received - a.received),
    standings: allUsers,
  });
}
