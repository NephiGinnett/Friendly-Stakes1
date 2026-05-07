import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unlocked = await prisma.userAchievement.findMany({
    where: { userId: user.id },
  });

  // Return all achievement IDs so the UI knows what exists,
  // but only reveal details for ones the user has unlocked
  const result = Object.values(ACHIEVEMENTS).map((a) => {
    const record = unlocked.find((u) => u.achievementId === a.id);
    return {
      id: a.id,
      unlocked: !!record,
      claimed: record?.claimed ?? false,
      unlockedAt: record?.unlockedAt ?? null,
      // Only reveal details if unlocked
      name: record ? a.name : "???",
      description: record ? a.description : null,
      reward: record ? a.reward : null,
      emoji: record ? a.emoji : "🔒",
    };
  });

  return NextResponse.json(result);
}
