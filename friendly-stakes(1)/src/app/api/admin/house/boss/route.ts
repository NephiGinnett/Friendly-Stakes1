import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { nextStrikeTime } from "@/lib/houseStrike";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { action } = await req.json();

  if (action === "launch") {
    const [playerCount, existing] = await Promise.all([
      prisma.user.count({ where: { isAdmin: false } }),
      prisma.houseConfig.findUnique({ where: { id: 1 } }),
    ]);
    const base = 1000 * Math.max(playerCount, 1);
    const bonus = existing?.sacrificeBonusHp ?? 0;
    const bossMaxHp = base + bonus;
    const firstStrike = nextStrikeTime();
    const config = await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, phase: 4, bossActive: true, bossHp: bossMaxHp, bossMaxHp, killerUserId: null, nextStrikeAt: firstStrike, sacrificeBonusHp: 0 },
      update: { phase: 4, bossActive: true, bossHp: bossMaxHp, bossMaxHp, killerUserId: null, nextStrikeAt: firstStrike, sacrificeBonusHp: 0 },
    });
    return NextResponse.json({ ok: true, bossHp: config.bossHp, bossMaxHp: config.bossMaxHp, bonusHpApplied: bonus });
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
