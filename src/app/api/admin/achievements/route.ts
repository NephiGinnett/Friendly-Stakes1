import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ACHIEVEMENTS, AchievementId } from "@/lib/achievements";
import { notifyUser, appUrl } from "@/lib/discordNotify";
import { hasBingo } from "@/lib/bingo";

/** List every achievement, plus who currently holds each one. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const held = await prisma.userAchievement.findMany({
    select: { achievementId: true, userId: true, claimed: true },
  });

  return NextResponse.json({
    achievements: Object.values(ACHIEVEMENTS).map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      reward: a.reward ?? null,
      holders: held.filter((h) => h.achievementId === a.id).map((h) => ({ userId: h.userId, claimed: h.claimed })),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { action, userId, achievementId } = await req.json();

  // One-shot catch-up for players who completed a bingo line while BINGO! was
  // still first-past-the-post. They can never trigger it through play — the
  // approval check only fires on the transition into a first line — so it has
  // to be handed out once. Idempotent: safe to re-run.
  if (action === "backfill_bingo") {
    const squares = await prisma.bingoSquare.findMany({
      where: { claimStatus: "approved" },
      select: { userId: true, position: true },
    });

    const byUser: Record<number, number[]> = {};
    for (const s of squares) {
      (byUser[s.userId] ??= []).push(s.position);
    }

    const granted: string[] = [];
    for (const [id, positions] of Object.entries(byUser)) {
      const uid = Number(id);
      if (!hasBingo(positions)) continue;
      const existing = await prisma.userAchievement.findUnique({
        where: { userId_achievementId: { userId: uid, achievementId: "bingo" } },
      });
      if (existing) continue;
      await prisma.userAchievement.create({ data: { userId: uid, achievementId: "bingo" } });
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { username: true } });
      if (u) granted.push(u.username);
      void notifyUser(
        uid,
        `🎱 **Achievement unlocked — BINGO!**\nYou completed a bingo line.\n> Claim it on your profile for 250 pts.\n${appUrl("/achievements")}`
      );
    }

    return NextResponse.json({ ok: true, granted, count: granted.length });
  }

  const achievement = ACHIEVEMENTS[achievementId as AchievementId];
  if (!achievement) return NextResponse.json({ error: "Unknown achievement" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, username: true },
  });
  if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (action === "grant") {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: target.id, achievementId } },
    });
    if (existing) {
      return NextResponse.json({ error: `${target.username} already has ${achievement.name}.` }, { status: 409 });
    }

    // Left unclaimed on purpose: the player claims it themselves and the reward
    // is paid once, through the normal claim path. Granting does not hand out
    // points directly.
    await prisma.userAchievement.create({
      data: { userId: target.id, achievementId },
    });

    void notifyUser(
      target.id,
      `${achievement.emoji} **Achievement unlocked — ${achievement.name}**\n${achievement.description}\n> Claim it on your profile.\n${appUrl("/achievements")}`
    );

    return NextResponse.json({
      ok: true,
      username: target.username,
      name: achievement.name,
      emoji: achievement.emoji,
      reward: achievement.reward ?? null,
    });
  }

  if (action === "revoke") {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: target.id, achievementId } },
    });
    if (!existing) {
      return NextResponse.json({ error: `${target.username} doesn't have ${achievement.name}.` }, { status: 404 });
    }

    await prisma.userAchievement.delete({
      where: { userId_achievementId: { userId: target.id, achievementId } },
    });

    // Points already claimed are deliberately left alone — clawing them back
    // silently would desync the point log. Adjust manually if that's intended.
    return NextResponse.json({
      ok: true,
      username: target.username,
      name: achievement.name,
      wasClaimed: existing.claimed,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
