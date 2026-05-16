import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { bookmarkTokens: true, arGachaPulls: true },
  });

  const [bookmarks, avidReaderUnlocked] = await Promise.all([
    prisma.userBookmark.findMany({
      where: { userId: user.id },
      include: { bookmark: true },
    }),
    prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: user.id, achievementId: "avid_reader" } },
    }),
  ]);

  return NextResponse.json({
    tokens: fullUser?.bookmarkTokens ?? 0,
    gachaPulls: fullUser?.arGachaPulls ?? 0,
    avidReaderOwned: !!avidReaderUnlocked,
    bookmarks: bookmarks.map((ub) => ({
      bookmarkId: ub.bookmarkId,
      label: ub.bookmark.label,
      imageUrl: ub.bookmark.imageUrl,
      tier: ub.bookmark.tier,
      count: ub.count,
    })),
  });
}
