import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser, appUrl } from "@/lib/discordNotify";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let useVpn = false;
  try {
    const body = await req.json();
    useVpn = !!body?.useVpn;
  } catch { /* body is optional */ }

  const challenge = await prisma.challenge.findUnique({ where: { id: parseInt(params.id) } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (challenge.status !== "pending") return NextResponse.json({ error: "Challenge is not pending" }, { status: 400 });
  if (challenge.creatorId === user.id) return NextResponse.json({ error: "Can't accept your own challenge" }, { status: 403 });

  // Targeted: only the specific target can accept
  if (challenge.targetId !== null && challenge.targetId !== user.id) {
    return NextResponse.json({ error: "This challenge is not for you" }, { status: 403 });
  }

  // VPN activation if requested and not already active
  let vpnUpdates: { vpnActive?: boolean; vpnSeed?: number } = {};
  if (useVpn && !challenge.vpnActive) {
    const vpnItem = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType: "temp_vpn", usesLeft: { gt: 0 } },
    });
    if (!vpnItem) return NextResponse.json({ error: "You don't have a Temporary VPN item." }, { status: 400 });
    vpnUpdates = { vpnActive: true, vpnSeed: Math.floor(Math.random() * 1_000_000) };
    await prisma.userItem.update({ where: { id: vpnItem.id }, data: { usesLeft: { decrement: 1 } } });
  }

  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: "active", acceptedById: user.id, ...vpnUpdates },
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

  void notifyUser(
    challenge.creatorId,
    `✅ **${user.username}** accepted your bounty!\n> "${challenge.title}"\n${appUrl(`/challenges`)}`
  );

  return NextResponse.json({ ok: true });
}
