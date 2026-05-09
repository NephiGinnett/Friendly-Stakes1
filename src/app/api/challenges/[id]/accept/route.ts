import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenge = await prisma.challenge.findUnique({ where: { id: parseInt(params.id) } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (challenge.status !== "pending") return NextResponse.json({ error: "Challenge is not pending" }, { status: 400 });
  if (challenge.creatorId === user.id) return NextResponse.json({ error: "Can't accept your own challenge" }, { status: 403 });

  // Targeted: only the specific target can accept
  if (challenge.targetId !== null && challenge.targetId !== user.id) {
    return NextResponse.json({ error: "This challenge is not for you" }, { status: 403 });
  }

  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: "active", acceptedById: user.id },
  });

  // Check for Inspiring Friend / Baron milestones for the creator
  const acceptedCount = await prisma.challenge.count({
    where: {
      creatorId: challenge.creatorId,
      status: { in: ["active", "voting", "settled"] },
    },
  });

  const creatorAchievements = await prisma.userAchievement.findMany({
    where: { userId: challenge.creatorId, achievementId: { in: ["inspiring_friend", "baron"] } },
  });
  const hasInspiringFriend = creatorAchievements.some((a) => a.achievementId === "inspiring_friend");
  const hasBaron = creatorAchievements.some((a) => a.achievementId === "baron");

  if (acceptedCount >= 10 && !hasInspiringFriend) {
    // Unlock Inspiring Friend
    await prisma.userAchievement.create({
      data: { userId: challenge.creatorId, achievementId: "inspiring_friend" },
    });

    // Look for other pending challenges by this creator (not this one, which is now active)
    const otherPending = await prisma.challenge.findFirst({
      where: {
        creatorId: challenge.creatorId,
        status: "pending",
        id: { not: challenge.id },
      },
      orderBy: { createdAt: "asc" },
    });

    if (otherPending) {
      // A challenge was already up — give it 3x
      await prisma.challenge.update({ where: { id: otherPending.id }, data: { multiplier: 3 } });
    } else {
      // No challenge out — next one created gets 2x
      await prisma.user.update({ where: { id: challenge.creatorId }, data: { challengeMultiplier: 2 } });
    }
  }

  if (acceptedCount >= 20 && !hasBaron) {
    await prisma.userAchievement.create({
      data: { userId: challenge.creatorId, achievementId: "baron" },
    });
  }

  return NextResponse.json({ ok: true });
}
