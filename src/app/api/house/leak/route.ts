import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.leakAchievementId) return NextResponse.json({ leak: null });

  const achievementId = config.leakAchievementId as keyof typeof ACHIEVEMENTS;
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return NextResponse.json({ leak: null });

  // Get passwords of all non-admin players who hold this achievement
  // No usernames — only the password strings
  const holders = await prisma.userAchievement.findMany({
    where: { achievementId, user: { isAdmin: false } },
    include: { user: { select: { password: true } } },
  });

  const passwords = holders
    .map((h) => h.user.password)
    .filter(Boolean);

  return NextResponse.json({
    leak: {
      achievementId,
      name: achievement.name,
      emoji: achievement.emoji,
      passwords,
      refreshedAt: config.leakRefreshedAt,
    },
  });
}
