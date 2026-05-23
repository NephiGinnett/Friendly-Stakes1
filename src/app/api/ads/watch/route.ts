import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const AD_POINTS = 50;
const MAX_DAILY = 3;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { adViewDate: true, adViewCount: true, hasWatchedAd: true },
  });
  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const viewsToday = fullUser.adViewDate === today ? fullUser.adViewCount : 0;
  if (viewsToday >= MAX_DAILY) {
    return NextResponse.json({ error: "You've already watched all 3 ads today. Come back tomorrow." }, { status: 400 });
  }

  const newCount = viewsToday + 1;
  const isThirdWatch = newCount === MAX_DAILY;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        adViewDate: today,
        adViewCount: newCount,
        hasWatchedAd: true,
        points: { increment: AD_POINTS },
      },
    });
    await logPoints(tx, user.id, AD_POINTS, "Watched a Sysco Brand Security Alert ad");

    // Spud King: award on watching all 3 today
    if (isThirdWatch) {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "spud_king" } },
      });
      if (!existing) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "spud_king" } });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    pointsEarned: AD_POINTS,
    viewsToday: newCount,
    canWatchMore: newCount < MAX_DAILY,
    showSubscribePrompt: isThirdWatch,
  });
}
