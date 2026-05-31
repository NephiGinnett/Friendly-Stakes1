import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const SYSCO_CHARGE_REASON = "Sysco Brand Security Alerts — weekly subscription renewal";

// One-time refund route for the May 30 2026 overcharge incident.
// Refunds every erroneous Sysco weekly charge logged today.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { confirm } = await req.json().catch(() => ({}));
  if (!confirm) {
    // Dry run — show what would be refunded without touching anything
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const charges = await prisma.pointLog.findMany({
      where: {
        reason: SYSCO_CHARGE_REASON,
        createdAt: { gte: todayStart },
        amount: { lt: 0 },
      },
      include: { user: { select: { username: true } } },
    });

    const byUser: Record<number, { username: string; chargeCount: number; totalCharged: number }> = {};
    for (const c of charges) {
      if (!byUser[c.userId]) byUser[c.userId] = { username: c.user.username, chargeCount: 0, totalCharged: 0 };
      byUser[c.userId].chargeCount++;
      byUser[c.userId].totalCharged += Math.abs(c.amount);
    }

    return NextResponse.json({
      dryRun: true,
      message: "Pass { confirm: true } to execute the refund.",
      affected: Object.entries(byUser).map(([id, d]) => ({ userId: Number(id), ...d })),
      totalToRefund: Object.values(byUser).reduce((s, d) => s + d.totalCharged, 0),
    });
  }

  // Execute refund
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const charges = await prisma.pointLog.findMany({
    where: {
      reason: SYSCO_CHARGE_REASON,
      createdAt: { gte: todayStart },
      amount: { lt: 0 },
    },
  });

  const byUser: Record<number, number> = {};
  for (const c of charges) {
    byUser[c.userId] = (byUser[c.userId] ?? 0) + Math.abs(c.amount);
  }

  let refunded = 0;
  for (const [userIdStr, amount] of Object.entries(byUser)) {
    const userId = Number(userIdStr);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { points: { increment: amount } } });
      await logPoints(tx, userId, amount, `Admin refund — Sysco overcharge incident 2026-05-30 (${amount} pts restored)`);
    });
    refunded++;
  }

  return NextResponse.json({
    ok: true,
    refunded,
    breakdown: Object.entries(byUser).map(([id, amt]) => ({ userId: Number(id), refunded: amt })),
    totalRefunded: Object.values(byUser).reduce((s, v) => s + v, 0),
  });
}
