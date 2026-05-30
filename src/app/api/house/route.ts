import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { HOUSE_PHASES } from "@/lib/house";

function todayUtcStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [config, spinToday, bj] = await Promise.all([
    prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, phase: 0 },
      update: {},
    }),
    prisma.houseSpin.findFirst({
      where: { userId: user.id, createdAt: { gte: todayUtcStart() } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.blackjackGame.findUnique({ where: { userId: user.id } }),
  ]);

  const phase = config.phase as 0 | 1 | 2 | 3 | 4;

  return NextResponse.json({
    phase,
    config: HOUSE_PHASES[phase],
    bossActive: config.bossActive,
    bossHp: config.bossHp,
    bossMaxHp: config.bossMaxHp,
    hasSpin: !!spinToday,
    lastSpinLabel: spinToday?.label ?? null,
    hasActiveBlackjack: bj?.status === "active",
    casinoOpen: config.casinoOpen,
    bossHpMultiplier: config.bossHpMultiplier,
    botsEnabled: config.botsEnabled,
    arFaireActive: config.arFaireActive,
    worldCupAdminAt: config.worldCupAdminAt,
    worldCupPlayerAt: config.worldCupPlayerAt,
    worldCupEventEndAt: config.worldCupEventEndAt,
  });
}
