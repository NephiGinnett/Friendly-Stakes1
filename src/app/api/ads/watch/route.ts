import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const AD_POINTS = 50;
const MAX_LIFETIME = 5;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({
    where: { id: 1 },
    select: { arFaireActive: true },
  });
  if (!config?.arFaireActive) {
    return NextResponse.json({ error: "Ads are only available during the AR Faire event." }, { status: 403 });
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { adViewCount: true, hasWatchedAd: true },
  });
  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const viewsTotal = fullUser.adViewCount;
  if (viewsTotal >= MAX_LIFETIME) {
    return NextResponse.json({ error: "You've already watched all 5 ads during this event." }, { status: 400 });
  }

  const newCount = viewsTotal + 1;
  const isFinalWatch = newCount === MAX_LIFETIME;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        adViewCount: newCount,
        hasWatchedAd: true,
        points: { increment: AD_POINTS },
      },
    });
    await logPoints(tx, user.id, AD_POINTS, "Watched a Sysco Brand Security Alert ad");

    if (isFinalWatch) {
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
    viewsTotal: newCount,
    canWatchMore: newCount < MAX_LIFETIME,
    showSubscribePrompt: isFinalWatch,
  });
}
