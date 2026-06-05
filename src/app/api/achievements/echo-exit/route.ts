import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId: user.id, achievementId: "echo_exit" } },
  });
  if (existing) return NextResponse.json({ ok: true, new: false });

  await prisma.userAchievement.create({
    data: { userId: user.id, achievementId: "echo_exit" },
  });

  return NextResponse.json({ ok: true, new: true });
}
