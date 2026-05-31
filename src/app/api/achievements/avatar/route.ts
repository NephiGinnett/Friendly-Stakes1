import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { achievementId } = await req.json();

  if (achievementId === null) {
    // Clear avatar
    await prisma.user.update({ where: { id: user.id }, data: { avatarAchievementId: null } });
    return NextResponse.json({ ok: true, avatarAchievementId: null });
  }

  // Must be claimed
  const record = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId: user.id, achievementId } },
  });
  if (!record?.claimed) {
    return NextResponse.json({ error: "You must claim this achievement first" }, { status: 403 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatarAchievementId: achievementId } });
  return NextResponse.json({ ok: true, avatarAchievementId: achievementId });
}
