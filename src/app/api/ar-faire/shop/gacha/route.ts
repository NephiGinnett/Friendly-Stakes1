import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const COST_PER_PULL = 5;

// Tier weights: uncommon=60, rare=25, epic=10, legendary=5
const TIER_WEIGHTS = { uncommon: 60, rare: 25, epic: 10, legendary: 5 };

function rollTier(): string {
  const roll = Math.random() * 100;
  if (roll < 5) return "legendary";
  if (roll < 15) return "epic";
  if (roll < 40) return "rare";
  return "uncommon";
}

async function pullOnce(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<number | null> {
  const tier = rollTier();
  const bookmarks = await tx.arBookmark.findMany({ where: { tier } });
  if (bookmarks.length === 0) {
    // Fallback to uncommon if no bookmarks of this tier
    const fallback = await tx.arBookmark.findMany({ where: { tier: "uncommon" } });
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)].id;
  }
  return bookmarks[Math.floor(Math.random() * bookmarks.length)].id;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await req.json(); // 1 or 10
  if (![1, 10].includes(count)) return NextResponse.json({ error: "Count must be 1 or 10" }, { status: 400 });

  const totalCost = count * COST_PER_PULL;
  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { bookmarkTokens: true, arGachaPulls: true } });
  if (!fullUser || fullUser.bookmarkTokens < totalCost) {
    return NextResponse.json({ error: `Need ${totalCost} Bookmark Tokens (you have ${fullUser?.bookmarkTokens ?? 0})` }, { status: 400 });
  }

  const pulledIds: number[] = [];
  const wonBookmarks: { bookmarkId: number; label: string; imageUrl: string; tier: string; isNew: boolean }[] = [];
  let legendaryPulled = false;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < count; i++) {
      const bookmarkId = await pullOnce(tx);
      if (bookmarkId === null) continue;
      pulledIds.push(bookmarkId);

      const bookmark = await tx.arBookmark.findUnique({ where: { id: bookmarkId } });
      if (!bookmark) continue;

      if (bookmark.tier === "legendary") legendaryPulled = true;

      const existing = await tx.userBookmark.findUnique({
        where: { userId_bookmarkId: { userId: user.id, bookmarkId } },
      });

      if (existing) {
        await tx.userBookmark.update({
          where: { userId_bookmarkId: { userId: user.id, bookmarkId } },
          data: { count: { increment: 1 } },
        });
        wonBookmarks.push({ bookmarkId, label: bookmark.label, imageUrl: bookmark.imageUrl, tier: bookmark.tier, isNew: false });
      } else {
        await tx.userBookmark.create({ data: { userId: user.id, bookmarkId } });
        wonBookmarks.push({ bookmarkId, label: bookmark.label, imageUrl: bookmark.imageUrl, tier: bookmark.tier, isNew: true });
      }
    }

    const newTotal = fullUser.arGachaPulls + pulledIds.length;
    await tx.user.update({
      where: { id: user.id },
      data: {
        bookmarkTokens: { decrement: pulledIds.length * COST_PER_PULL },
        arGachaPulls: { increment: pulledIds.length },
      },
    });

    // Achievements
    if (legendaryPulled) {
      const hasLegendary = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "legendary_pull" } },
      });
      if (!hasLegendary) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "legendary_pull" } });
      }
    }

    if (fullUser.arGachaPulls < 25 && newTotal >= 25) {
      const hasCollector = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "bookmark_collector" } },
      });
      if (!hasCollector) {
        await tx.userAchievement.create({ data: { userId: user.id, achievementId: "bookmark_collector" } });
        // Grant 25 tokens immediately
        await tx.user.update({ where: { id: user.id }, data: { bookmarkTokens: { increment: 25 } } });
      }
    }
  });

  return NextResponse.json({ pulls: wonBookmarks, totalCost: pulledIds.length * COST_PER_PULL });
}
