import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logPoints } from "@/lib/pointLog";

const SYSCO_COST = 350;
const OVERCHARGE_FEE = 50;

// Called every Monday at 8AM. Deducts 350 pts from each subscriber.
// If they can't pay (even going negative), removes subscription and charges a 50pt overcharge fee.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscribers = await prisma.user.findMany({
    where: { syscoSubscriber: true },
    select: { id: true, points: true },
  });

  let billed = 0;
  let cancelled = 0;

  for (const sub of subscribers) {
    if (sub.points >= SYSCO_COST) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: sub.id }, data: { points: { decrement: SYSCO_COST } } });
        await logPoints(tx, sub.id, -SYSCO_COST, "Sysco Brand Security Alerts — weekly subscription renewal");
      });
      billed++;
    } else {
      // Can't pay — remove subscription, charge overcharge fee (can go negative)
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: sub.id },
          data: { syscoSubscriber: false, points: { decrement: OVERCHARGE_FEE } },
        });
        await logPoints(tx, sub.id, -OVERCHARGE_FEE, "Sysco subscription lapsed — overcharge fee");
      });
      cancelled++;
    }
  }

  return NextResponse.json({ ok: true, billed, cancelled });
}
