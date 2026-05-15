import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { targetUsername, amount } = await req.json();

    if (!targetUsername || !amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Donor must have the St Sins tag
    const hasStsins = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType: "stsins" },
    });
    if (!hasStsins) {
      return NextResponse.json({ error: "You need the St Sins tag to donate" }, { status: 403 });
    }

    // Target must have the Be Cou tag
    const target = await prisma.user.findUnique({ where: { username: targetUsername } });
    if (!target) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const targetHasBecou = await prisma.userItem.findFirst({
      where: { userId: target.id, itemType: "becou" },
    });
    if (!targetHasBecou) {
      return NextResponse.json({ error: "That player doesn't have the Be Cou tag" }, { status: 400 });
    }

    // Refetch donor's current balance
    const donor = await prisma.user.findUnique({ where: { id: user.id } });
    if (!donor || donor.points < amount) {
      return NextResponse.json({ error: "Not enough points" }, { status: 400 });
    }

    const updatedDonor = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { points: { decrement: amount }, totalDonated: { increment: amount } },
        select: { totalDonated: true },
      });
      await tx.user.update({ where: { id: target.id }, data: { points: { increment: amount } } });
      await logPoints(tx, user.id, -amount, `Donated to ${target.username} (St Sins)`);
      await logPoints(tx, target.id, amount, `Received donation from ${user.username} (Be Cou)`);
      return updated;
    });

    // Unlock Noble Sacrifice when cumulative donations reach 1000
    if (updatedDonor.totalDonated >= 1000) {
      const already = await prisma.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "noble_sacrifice" } },
      });
      if (!already) {
        await prisma.userAchievement.create({
          data: { userId: user.id, achievementId: "noble_sacrifice" },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
