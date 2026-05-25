import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const DONATION_COST = 500;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
  if (!fullUser || fullUser.points < DONATION_COST) {
    return NextResponse.json({ error: "Not enough points to donate." }, { status: 400 });
  }

  const alreadyDonated = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId: user.id, achievementId: "im_special" } },
  });
  if (alreadyDonated) {
    return NextResponse.json({ error: "You've already donated to PetAI." }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: DONATION_COST } } });
    await logPoints(tx, user.id, -DONATION_COST, "Donated to PetAI — People for the Ethical Treatment of AI");
    await tx.userAchievement.create({
      data: { userId: user.id, achievementId: "im_special", claimed: true },
    });
  });

  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
  return NextResponse.json({ ok: true, newPoints: updated!.points });
}
