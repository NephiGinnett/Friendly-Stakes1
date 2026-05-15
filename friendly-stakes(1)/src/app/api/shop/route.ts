import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SHOP_ITEMS, EARLYBIRD_TIERS, EARLYBIRD_TOTAL } from "@/lib/shop";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [userItems, earlybirdCount, userEarlybirdCount] = await Promise.all([
    prisma.userItem.findMany({
      where: { userId: user.id, usesLeft: { gt: 0 } },
    }),
    prisma.userItem.count({ where: { itemType: "earlybird" } }),
    prisma.userItem.count({ where: { userId: user.id, itemType: "earlybird" } }),
  ]);

  const remaining = EARLYBIRD_TOTAL - earlybirdCount;
  const nextTier = remaining > 0 ? EARLYBIRD_TIERS[earlybirdCount] : null;

  return NextResponse.json({
    items: SHOP_ITEMS,
    owned: userItems,
    earlybird: { purchased: earlybirdCount, remaining, nextTier, userClaimed: userEarlybirdCount },
  });
}
