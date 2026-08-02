import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.leakAchievementId || config.passwordLeakEnabled === false) return NextResponse.json({ leak: null });

  const achievementId = config.leakAchievementId as keyof typeof ACHIEVEMENTS;
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return NextResponse.json({ leak: null });

  // Serve only the frozen snapshot taken when this leak was drawn. This route
  // never reads a live password — a player who changes theirs after the leak
  // leaves a stale string here rather than republishing their new one.
  //
  // A leak with no snapshot (drawn before snapshots existed) shows nothing. We
  // deliberately do NOT capture one now: the draw-time passwords are gone, and
  // anyone who has already changed theirs would have the *new* value frozen in
  // — the exact leak this mechanic is meant to prevent. Publishing nothing is
  // correct; the leak returns at the next draw.
  let passwords: string[] = [];
  try {
    const parsed = JSON.parse(config.leakPasswords || "[]");
    if (Array.isArray(parsed)) passwords = parsed.filter((p): p is string => typeof p === "string" && !!p);
  } catch { /* malformed snapshot — show nothing rather than guess */ }

  if (passwords.length === 0) return NextResponse.json({ leak: null });

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
