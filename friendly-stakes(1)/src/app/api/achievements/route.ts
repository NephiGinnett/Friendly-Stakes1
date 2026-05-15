import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [unlocked, fuckYouFirst] = await Promise.all([
    prisma.userAchievement.findMany({ where: { userId: user.id } }),
    // Anyone can see the first claimer's frozen data once they unlock the achievement
    prisma.userAchievement.findFirst({
      where: { achievementId: "fuck_you", frozenData: { not: null } },
      orderBy: { unlockedAt: "asc" },
      select: { frozenData: true },
    }),
  ]);

  const result = Object.values(ACHIEVEMENTS).map((a) => {
    const record = unlocked.find((u) => u.achievementId === a.id);
    const base = {
      id: a.id,
      unlocked: !!record,
      claimed: record?.claimed ?? false,
      unlockedAt: record?.unlockedAt ?? null,
      name: record ? a.name : "???",
      description: record ? a.description : null,
      reward: record ? (a.reward ?? null) : null,
      emoji: record ? a.emoji : "🔒",
      frozenData: null as string | null,
    };

    if (a.id === "fuck_you" && fuckYouFirst?.frozenData) {
      base.frozenData = fuckYouFirst.frozenData;
    }

    return base;
  });

  return NextResponse.json(result);
}
