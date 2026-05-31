import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const CANS_PER_TRADE = 5;
const PTS_PER_TRADE = 100;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  return NextResponse.json({
    monitorCans: entry.monitorCans,
    tradeRate: { cans: CANS_PER_TRADE, points: PTS_PER_TRADE },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, amount } = await req.json();

  if (action !== "trade") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const batches = parseInt(amount) || 1;
  if (batches < 1) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const cansNeeded = batches * CANS_PER_TRADE;
  const pointsGained = batches * PTS_PER_TRADE;

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });
  if (entry.monitorCans < cansNeeded) {
    return NextResponse.json(
      { error: `Need ${cansNeeded} 🥤 cans (you have ${entry.monitorCans})` },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.worldCupEntry.update({
      where: { userId: user.id },
      data: { monitorCans: { decrement: cansNeeded } },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { points: { increment: pointsGained } },
    });
    await logPoints(tx, user.id, pointsGained, `World Cup shop — traded ${cansNeeded} Monitor Cans`);
  });

  const updated = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ ok: true, monitorCans: updated?.monitorCans ?? 0, pointsGained });
}
