import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { message, rewardType, rewardAmount, rewardItem, rewardItemUses } = await req.json();

  if (!message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (!["points", "item"].includes(rewardType)) return NextResponse.json({ error: "Invalid reward type" }, { status: 400 });
  if (rewardType === "points" && (!rewardAmount || rewardAmount < 1)) {
    return NextResponse.json({ error: "Points amount must be at least 1" }, { status: 400 });
  }
  if (rewardType === "item" && !rewardItem?.trim()) {
    return NextResponse.json({ error: "Item type is required" }, { status: 400 });
  }

  const distribution = await prisma.adminDistribution.create({
    data: {
      message: message.trim(),
      rewardType,
      rewardAmount: rewardType === "points" ? rewardAmount : 0,
      rewardItem: rewardType === "item" ? rewardItem.trim() : "",
      rewardItemUses: rewardType === "item" ? (rewardItemUses ?? 1) : 1,
    },
  });

  return NextResponse.json({ ok: true, id: distribution.id });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const distributions = await prisma.adminDistribution.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { claims: true } } },
  });

  return NextResponse.json(distributions.map((d) => ({
    id: d.id,
    message: d.message,
    rewardType: d.rewardType,
    rewardAmount: d.rewardAmount,
    rewardItem: d.rewardItem,
    rewardItemUses: d.rewardItemUses,
    claimCount: d._count.claims,
    createdAt: d.createdAt,
  })));
}
