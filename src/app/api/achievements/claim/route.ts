import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS, AchievementId } from "@/lib/achievements";
import { logPoints } from "@/lib/pointLog";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { achievementId } = await req.json();

    const achievement = ACHIEVEMENTS[achievementId as AchievementId];
    if (!achievement) {
      return NextResponse.json({ error: "Unknown achievement" }, { status: 400 });
    }

    const record = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: user.id, achievementId } },
    });

    if (!record) {
      return NextResponse.json({ error: "You haven't unlocked this achievement yet" }, { status: 403 });
    }
    if (record.claimed) {
      return NextResponse.json({ error: "Already claimed!" }, { status: 409 });
    }

    // No-reward achievements (already claimed at purchase time, e.g. avid_reader)
    if (achievement.rewardType === "none") {
      return NextResponse.json({ ok: true, newPoints: user.points, rewardType: "none" });
    }

    // Token reward (bookmark_collector)
    if (achievement.rewardType === "tokens") {
      const tokens = (achievement as { rewardTokens: number }).rewardTokens;
      await prisma.$transaction(async (tx) => {
        await tx.userAchievement.update({
          where: { userId_achievementId: { userId: user.id, achievementId } },
          data: { claimed: true },
        });
        await tx.user.update({ where: { id: user.id }, data: { bookmarkTokens: { increment: tokens } } });
      });
      const currentUser = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
      return NextResponse.json({ ok: true, newPoints: currentUser!.points, rewardType: "tokens", rewardTokens: tokens });
    }

    // Passive achievements (Baron, Inspiring Friend) — just acknowledge
    if (achievement.rewardType === "passive") {
      await prisma.userAchievement.update({
        where: { userId_achievementId: { userId: user.id, achievementId } },
        data: { claimed: true },
      });
      const currentUser = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
      return NextResponse.json({ ok: true, newPoints: currentUser!.points, rewardType: "passive" });
    }

    if (achievement.rewardType === "item") {
      await prisma.$transaction(async (tx) => {
        await tx.userAchievement.update({
          where: { userId_achievementId: { userId: user.id, achievementId } },
          data: { claimed: true },
        });
        await tx.userItem.create({
          data: {
            userId: user.id,
            itemType: (achievement as { rewardItem: string }).rewardItem,
            usesLeft: (achievement as { rewardItemUses: number }).rewardItemUses,
          },
        });
      });

      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { points: true },
      });

      return NextResponse.json({
        ok: true,
        newPoints: currentUser!.points,
        rewardType: "item",
        rewardLabel: achievement.reward,
      });
    }

    const pointsData =
      achievement.rewardType === "swap"
        ? { points: achievement.rewardPoints }
        : { points: { increment: achievement.rewardPoints } };

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.userAchievement.update({
        where: { userId_achievementId: { userId: user.id, achievementId } },
        data: { claimed: true },
      });
      const updated = await tx.user.update({ where: { id: user.id }, data: pointsData, select: { points: true } });
      const delta = achievement.rewardType === "swap"
        ? achievement.rewardPoints - user.points
        : achievement.rewardPoints;
      await logPoints(tx, user.id, delta, `Achievement: ${achievement.name}`);
      return updated;
    });

    return NextResponse.json({
      ok: true,
      newPoints: updatedUser.points,
      rewardType: achievement.rewardType,
      rewardPoints: achievement.rewardPoints,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
