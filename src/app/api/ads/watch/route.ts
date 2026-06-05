import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const AD_POINTS = 50;
const NORMAL_DAILY = 3;
const EVENT_DAILY = 5;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [fullUser, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { adViewDate: true, adViewCount: true, hasWatchedAd: true },
    }),
    prisma.houseConfig.findUnique({
      where: { id: 1 },
      select: { worldCupPlayerAt: true, worldCupEventEndAt: true },
    }),
  ]);
  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const worldCupActive =
    !!config?.worldCupPlayerAt && now >= config.worldCupPlayerAt &&
    (!config.worldCupEventEndAt || now < config.worldCupEventEndAt);
  const maxDaily = worldCupActive ? EVENT_DAILY : NORMAL_DAILY;
  const today = new Date().toISOString().slice(0, 10);
  const viewsToday = fullUser.adViewDate === today ? fullUser.adViewCount : 0;

  if (viewsToday >= maxDaily) {
    return NextResponse.json({
      error: `You've already watched all ${maxDaily} ads today. Come back tomorrow.`,
    }, { status: 400 });
  }

  const newCount = viewsToday + 1;
  const isLastWatch = newCount === maxDaily; // Spud King unlocks when the daily cap is reached

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

    if (isLastWatch) {
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
    maxDaily,
    canWatchMore: newCount < maxDaily,
    showSubscribePrompt: isLastWatch,
  });
}
