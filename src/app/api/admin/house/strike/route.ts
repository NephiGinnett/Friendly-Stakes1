import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { executeHouseStrike, nextStrikeTime } from "@/lib/houseStrike";
import { refreshPasswordLeak } from "@/lib/passwordLeak";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.bossActive) return NextResponse.json({ error: "Boss is not active." }, { status: 400 });

  const result = await executeHouseStrike();
  if (!result) return NextResponse.json({ error: "No eligible players to strike." }, { status: 400 });

  // Count strikes since last leak refresh; refresh on every other strike
  const newStrikeCount = (config.strikesSinceLeak ?? 0) + 1;
  let leakRefreshed = false;
  if (newStrikeCount >= 2) {
    await refreshPasswordLeak(); // resets strikesSinceLeak to 0 internally
    leakRefreshed = true;
  } else {
    await prisma.houseConfig.update({
      where: { id: 1 },
      data: { strikesSinceLeak: newStrikeCount, nextStrikeAt: nextStrikeTime() },
    });
  }

  if (!leakRefreshed) {
    await prisma.houseConfig.update({
      where: { id: 1 },
      data: { nextStrikeAt: nextStrikeTime() },
    });
  }

  return NextResponse.json({ ok: true, leakRefreshed, ...result });
}
