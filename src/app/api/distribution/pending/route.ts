import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const claimed = await prisma.adminDistributionClaim.findMany({
    where: { userId: user.id },
    select: { distributionId: true },
  });
  const claimedIds = new Set(claimed.map((c) => c.distributionId));

  const all = await prisma.adminDistribution.findMany({
    orderBy: { createdAt: "desc" },
  });

  const pending = all.filter((d) => !claimedIds.has(d.id));

  return NextResponse.json(pending.map((d) => ({
    id: d.id,
    message: d.message,
    rewardType: d.rewardType,
    rewardAmount: d.rewardAmount,
    rewardItem: d.rewardItem,
    rewardItemUses: d.rewardItemUses,
  })));
}
