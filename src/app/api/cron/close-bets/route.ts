import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logPoints } from "@/lib/pointLog";

// Runs periodically (e.g. every 5 min). Transitions open wagers whose deadline has passed:
//   - has against entries → "started" (bet is locked, proceeds to voting phase normally)
//   - no against entries  → "cancelled" + full refund to creator
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const expiredWagers = await prisma.wager.findMany({
    where: { status: "open", deadline: { lt: now } },
    include: { entries: true },
  });

  let started = 0;
  let cancelled = 0;

  for (const wager of expiredWagers) {
    const hasAgainst = wager.entries.some((e) => e.side === "against");

    if (hasAgainst) {
      await prisma.wager.update({
        where: { id: wager.id },
        data: { status: "started" },
      });
      started++;
    } else {
      // No takers — refund creator and cancel
      const refunds: { userId: number; amount: number }[] = [
        { userId: wager.creatorId, amount: wager.creatorStake },
        ...wager.entries.map((e) => ({ userId: e.userId, amount: e.stake })),
      ];

      await prisma.$transaction(async (tx) => {
        await tx.wager.update({
          where: { id: wager.id },
          data: { status: "cancelled", settledAt: now, settledBy: "admin" },
        });
        for (const r of refunds) {
          await tx.user.update({
            where: { id: r.userId },
            data: { points: { increment: r.amount } },
          });
          await logPoints(tx, r.userId, r.amount, `Refund — wager expired with no takers: ${wager.title}`);
        }
      });
      cancelled++;
    }
  }

  return NextResponse.json({ ok: true, started, cancelled });
}
