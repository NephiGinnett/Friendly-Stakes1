import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

const SYSCO_COST = 350;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hasWatchedAd: true, syscoSubscriber: true, points: true },
  });
  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!fullUser.hasWatchedAd) {
    return NextResponse.json({ error: "You must watch the Sysco ad before subscribing." }, { status: 403 });
  }
  if (fullUser.syscoSubscriber) {
    return NextResponse.json({ error: "You are already subscribed." }, { status: 400 });
  }
  if (fullUser.points < SYSCO_COST) {
    return NextResponse.json({ error: `Not enough points. Need ${SYSCO_COST}.` }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { syscoSubscriber: true, points: { decrement: SYSCO_COST } },
    });
    await logPoints(tx, user.id, -SYSCO_COST, "Sysco Brand Security Alerts subscription");
    // Grant first ward immediately
    await tx.userItem.create({ data: { userId: user.id, itemType: "ward", usesLeft: 1 } });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Block cancellations on Sunday (day 0)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0) {
    return NextResponse.json({ error: "Cancellations are not permitted on Sunday. The House is watching." }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { syscoSubscriber: false },
  });

  return NextResponse.json({ ok: true });
}
