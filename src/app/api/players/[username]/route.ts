import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await prisma.user.findUnique({
    where: { username: params.username.toLowerCase() },
    select: { id: true, username: true, points: true, isAdmin: true, avatarAchievementId: true },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [wagers, achievementRecords] = await Promise.all([
    prisma.wager.findMany({
      where: {
        OR: [
          { creatorId: player.id },
          { entries: { some: { userId: player.id } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, username: true } },
        entries: { select: { userId: true, side: true, stake: true } },
      },
    }),
    prisma.userAchievement.findMany({ where: { userId: player.id } }),
  ]);

  const achievements = achievementRecords
    .filter(r => ACHIEVEMENTS[r.achievementId as keyof typeof ACHIEVEMENTS])
    .map(r => {
      const def = ACHIEVEMENTS[r.achievementId as keyof typeof ACHIEVEMENTS];
      return { id: r.achievementId, name: def.name, emoji: def.emoji, imageUrl: (def as { imageUrl?: string }).imageUrl ?? null, unlockedAt: r.unlockedAt };
    });

  return NextResponse.json({ player, wagers, achievements });
}
