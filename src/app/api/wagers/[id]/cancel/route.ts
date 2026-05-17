import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const wagerId = parseInt(params.id);
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: { entries: true },
  });

  if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
  if (wager.status === "settled" || wager.status === "cancelled") {
    return NextResponse.json({ error: "Wager already resolved" }, { status: 400 });
  }

  // Refund creator stake + all entry stakes
  const refunds: { userId: number; amount: number }[] = [
    { userId: wager.creatorId, amount: wager.creatorStake },
    ...wager.entries.map((e) => ({ userId: e.userId, amount: e.stake })),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.wager.update({
      where: { id: wagerId },
      data: { status: "cancelled", settledAt: new Date(), settledBy: "admin" },
    });
    for (const r of refunds) {
      await tx.user.update({ where: { id: r.userId }, data: { points: { increment: r.amount } } });
      await logPoints(tx, r.userId, r.amount, `Refund — wager cancelled: ${wager.title}`);
    }
  });

  return NextResponse.json({ ok: true, refundCount: refunds.length });
}
