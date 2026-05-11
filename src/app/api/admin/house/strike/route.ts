import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { executeHouseStrike, nextStrikeTime } from "@/lib/houseStrike";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.bossActive) return NextResponse.json({ error: "Boss is not active." }, { status: 400 });

  const result = await executeHouseStrike();
  if (!result) return NextResponse.json({ error: "No eligible players to strike." }, { status: 400 });

  // Reschedule next auto-strike after a manual strike
  await prisma.houseConfig.update({
    where: { id: 1 },
    data: { nextStrikeAt: nextStrikeTime() },
  });

  return NextResponse.json({ ok: true, ...result });
}
