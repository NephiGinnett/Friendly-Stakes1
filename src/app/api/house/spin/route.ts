import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pickSpinOutcome, HOUSE_PHASES } from "@/lib/house";
import { logPoints } from "@/lib/pointLog";
import { todayUtcDate, isStrikeWindow } from "@/lib/houseStrike";
import { healBossFromLoss } from "@/lib/bossHeal";
import { NOISE_SOURCE } from "@/lib/houseLog";

function todayUtcStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.houseBanDate === todayUtcDate()) {
    return NextResponse.json({ error: "The House has revoked your wheel privileges today. You shouldn't have woken it." }, { status: 403 });
  }

  const config = await prisma.houseConfig.upsert({
    where: { id: 1 }, create: { id: 1, phase: 0 }, update: {},
  });

  const phase = config.phase as 0 | 1 | 2 | 3 | 4;
  const phaseConfig = HOUSE_PHASES[phase];

  // Phase 4 bypasses the spinLocked gate — games still run, losses heal the boss
  if (phaseConfig.spinLocked && phase !== 4) {
    return NextResponse.json({ error: "The wheel is offline." }, { status: 403 });
  }

  if (!config.casinoOpen) {
    return NextResponse.json({ error: "ACCESS RESTRICTED. The casino floor has been sealed for recalibration. Your presence here has been logged. Re-opens: Friday." }, { status: 403 });
  }

  const alreadySpun = await prisma.houseSpin.findFirst({
    where: { userId: user.id, createdAt: { gte: todayUtcStart() } },
  });
  if (alreadySpun) {
    return NextResponse.json({ error: "You've already spun today." }, { status: 409 });
  }

  const { outcome, index } = pickSpinOutcome();
  let bossHealed = 0;
  const sleeping = !isStrikeWindow();

  await prisma.$transaction(async (tx) => {
    await tx.houseSpin.create({
      data: { userId: user.id, result: outcome.amount, label: outcome.label, item: outcome.item ?? null },
    });

    if (outcome.amount !== 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { points: { increment: outcome.amount } },
      });
      await logPoints(tx, user.id, outcome.amount, `House Spin: ${outcome.label}`);
    } else if (outcome.item) {
      await tx.userItem.create({
        data: { userId: user.id, itemType: outcome.item, usesLeft: 1 },
      });
    }

    // Phase 4: player loss heals the boss (2 pts = 1 HP, same ratio as attacks)
    if (outcome.amount < 0) bossHealed = await healBossFromLoss(tx, user.id, Math.abs(outcome.amount));

    // Playing during sleep window counts as a 50-pt "noise contribution" for wake chance
    if (sleeping) {
      await tx.houseDamageLog.create({
        data: { userId: user.id, amount: 25, source: NOISE_SOURCE },
      });
    }
  });

  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });

  return NextResponse.json({ outcomeIndex: index, outcome, newPoints: updated!.points, bossHealed });
}
