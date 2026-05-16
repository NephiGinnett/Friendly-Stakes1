import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const COST_PER_PULL = 5;
const MAX_PITY = 15; // caps at double base epic+legendary rates (15% → 30%)

// Each pity stack shifts +1% from uncommon/rare → epic/legendary (2:1 split epic:legendary)
function rollTier(pity: number): string {
  const p = Math.min(pity, MAX_PITY);
  const legendary = 5 + p / 3;
  const epic = 10 + (2 * p) / 3;
  const rare = 25 - p * (25 / 85);
  const roll = Math.random() * 100;
  if (roll < legendary) return "legendary";
  if (roll < legendary + epic) return "epic";
  if (roll < legendary + epic + rare) return "rare";
  return "uncommon";
}

async function pullBookmark(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tier: string,
): Promise<number | null> {
  const bookmarks = await tx.arBookmark.findMany({ where: { tier } });
  if (bookmarks.length === 0) {
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
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { bookmarkTokens: true, arGachaPulls: true, gachaPityCounter: true },
  });
  if (!fullUser || fullUser.bookmarkTokens < totalCost) {
    return NextResponse.json({ error: `Need ${totalCost} Bookmark Tokens (you have ${fullUser?.bookmarkTokens ?? 0})` }, { status: 400 });
  }

  const wonBookmarks: { bookmarkId: number; label: string; imageUrl: string; tier: string; isNew: boolean }[] = [];
  let legendaryPulled = false;
  let pulledCount = 0;
  let currentPity = fullUser.gachaPityCounter;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < count; i++) {
      const tier = rollTier(currentPity);
      const bookmarkId = await pullBookmark(tx, tier);
      if (bookmarkId === null) continue;
      pulledCount++;

      const bookmark = await tx.arBookmark.findUnique({ where: { id: bookmarkId } });
      if (!bookmark) continue;

      if (bookmark.tier === "legendary") legendaryPulled = true;

      // Update pity: reset on epic/legendary, increment on uncommon/rare
      if (tier === "epic" || tier === "legendary") {
        currentPity = 0;
      } else {
        currentPity = Math.min(currentPity + 1, MAX_PITY);
      }

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

    const newTotal = fullUser.arGachaPulls + pulledCount;
    await tx.user.update({
      where: { id: user.id },
      data: {
        bookmarkTokens: { decrement: pulledCount * COST_PER_PULL },
        arGachaPulls: { increment: pulledCount },
        gachaPityCounter: currentPity,
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
        await tx.user.update({ where: { id: user.id }, data: { bookmarkTokens: { increment: 25 } } });
      }
    }
  });

  return NextResponse.json({ pulls: wonBookmarks, totalCost: pulledCount * COST_PER_PULL });
}
