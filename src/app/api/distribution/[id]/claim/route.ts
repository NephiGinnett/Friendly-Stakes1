import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const distributionId = parseInt(params.id);
  const distribution = await prisma.adminDistribution.findUnique({ where: { id: distributionId } });
  if (!distribution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const alreadyClaimed = await prisma.adminDistributionClaim.findUnique({
    where: { distributionId_userId: { distributionId, userId: user.id } },
  });
  if (alreadyClaimed) return NextResponse.json({ error: "Already claimed" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.adminDistributionClaim.create({ data: { distributionId, userId: user.id } });

    if (distribution.rewardType === "points") {
      await tx.user.update({ where: { id: user.id }, data: { points: { increment: distribution.rewardAmount } } });
      await logPoints(tx, user.id, distribution.rewardAmount, `Admin distribution: ${distribution.message}`);
    } else if (distribution.rewardType === "item") {
      await tx.userItem.create({
        data: { userId: user.id, itemType: distribution.rewardItem, usesLeft: distribution.rewardItemUses },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
