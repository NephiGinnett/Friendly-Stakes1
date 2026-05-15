import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { nextStrikeTime } from "@/lib/houseStrike";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  if (action === "setMultiplier") {
    const { multiplier } = body;
    if (!multiplier || multiplier < 100) return NextResponse.json({ error: "Multiplier must be at least 100" }, { status: 400 });
    const config = await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, bossHpMultiplier: multiplier },
      update: { bossHpMultiplier: multiplier },
    });
    return NextResponse.json({ ok: true, bossHpMultiplier: config.bossHpMultiplier });
  }

  if (action === "adjustHp") {
    const { delta } = body;
    if (typeof delta !== "number") return NextResponse.json({ error: "delta must be a number" }, { status: 400 });
    const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
    if (!config?.bossActive) return NextResponse.json({ error: "Boss not active" }, { status: 400 });
    const newHp = Math.max(0, Math.min(config.bossHp + delta, config.bossMaxHp));
    await prisma.houseConfig.update({ where: { id: 1 }, data: { bossHp: newHp } });
    return NextResponse.json({ ok: true, bossHp: newHp, bossMaxHp: config.bossMaxHp });
  }

  if (action === "launch") {
    const [playerCount, existing] = await Promise.all([
      prisma.user.count({ where: { isAdmin: false } }),
      prisma.houseConfig.findUnique({ where: { id: 1 } }),
    ]);
    const multiplier = existing?.bossHpMultiplier ?? 3000;
    const base = multiplier * Math.max(playerCount, 1);
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
