import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { nextStrikeTime } from "@/lib/houseStrike";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { action } = await req.json();

  if (action === "launch") {
    const playerCount = await prisma.user.count({ where: { isAdmin: false } });
    const bossMaxHp = 1000 * Math.max(playerCount, 1);
    const firstStrike = nextStrikeTime();
    const config = await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, phase: 4, bossActive: true, bossHp: bossMaxHp, bossMaxHp, killerUserId: null, nextStrikeAt: firstStrike },
      update: { phase: 4, bossActive: true, bossHp: bossMaxHp, bossMaxHp, killerUserId: null, nextStrikeAt: firstStrike },
    });
    return NextResponse.json({ ok: true, bossHp: config.bossHp, bossMaxHp: config.bossMaxHp });
  }

  if (action === "defeat") {
    await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, bossActive: false, bossHp: 0 },
      update: { bossActive: false, bossHp: 0 },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
