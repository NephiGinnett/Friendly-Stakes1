import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { captureLeakPasswords } from "@/lib/passwordLeak";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.leakAchievementId || config.passwordLeakEnabled === false) return NextResponse.json({ leak: null });

  const achievementId = config.leakAchievementId as keyof typeof ACHIEVEMENTS;
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return NextResponse.json({ leak: null });

  // Serve the frozen snapshot taken when this leak was drawn — never a live
  // read. A player who changes their password after the leak leaves a stale
  // string here rather than republishing their new one.
  let passwords: string[] = [];
  try {
    const parsed = JSON.parse(config.leakPasswords || "[]");
    if (Array.isArray(parsed)) passwords = parsed.filter((p): p is string => typeof p === "string" && !!p);
  } catch { /* fall through to the backfill below */ }

  // A leak drawn before snapshots existed has no frozen list. Capture one now
  // and freeze it, so the current leak keeps working and stops tracking live
  // passwords from this point on.
  if (!config.leakPasswords) {
    passwords = await captureLeakPasswords(achievementId);
    await prisma.houseConfig.update({
      where: { id: 1 },
      data: { leakPasswords: JSON.stringify(passwords) },
    });
  }

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
