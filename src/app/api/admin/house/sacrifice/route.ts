import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { log } from "@/lib/pointLog";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { action } = await req.json();

  // ── Open voting ────────────────────────────────────────────────────────────
  if (action === "open") {
    // Clear any previous votes first
    await prisma.sacrificeVote.deleteMany();
    await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, sacrificeOpen: true },
      update: { sacrificeOpen: true },
    });
    return NextResponse.json({ ok: true, status: "open" });
  }

  // ── Close voting without executing ────────────────────────────────────────
  if (action === "close") {
    await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, sacrificeOpen: false },
      update: { sacrificeOpen: false },
    });
    return NextResponse.json({ ok: true, status: "closed" });
  }

  // ── Execute sacrifice (close + process result) ─────────────────────────────
  if (action === "execute") {
    const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });

    // Tally votes
    const allVotes = await prisma.sacrificeVote.findMany();
    if (allVotes.length === 0) return NextResponse.json({ error: "No votes cast yet." }, { status: 400 });

    const tally: Record<number, number> = {};
    for (const v of allVotes) {
      tally[v.targetId] = (tally[v.targetId] ?? 0) + v.weight;
    }

    // Highest vote count wins; ties broken randomly
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const maxVotes = Number(sorted[0][1]);
    const topIds = sorted.filter(([, v]) => v === maxVotes).map(([id]) => Number(id));
    const sacrificedId = topIds[Math.floor(Math.random() * topIds.length)];

    const sacrificed = await prisma.user.findUnique({ where: { id: sacrificedId } });
    if (!sacrificed) return NextResponse.json({ error: "Sacrificed player not found." }, { status: 500 });

    const sacrificedPoints = sacrificed.points;
    if (sacrificedPoints <= 0) {
      // Close vote but nothing meaningful to sacrifice
      await prisma.houseConfig.update({ where: { id: 1 }, data: { sacrificeOpen: false } });
      await prisma.sacrificeVote.deleteMany();
      return NextResponse.json({ ok: true, username: sacrificed.username, sacrificedPoints: 0, houseHeal: 0, sharePerPlayer: 0 });
    }

    const houseHeal = Math.floor(sacrificedPoints / 2);
    const remainingPlayers = await prisma.user.findMany({
      where: { isAdmin: false, id: { not: sacrificedId } },
      select: { id: true, username: true },
    });
    const sharePerPlayer = remainingPlayers.length > 0 ? Math.floor(sacrificedPoints / 2 / remainingPlayers.length) : 0;

    // All non-admin players sorted by points to determine achievements
    const allNonAdmin = await prisma.user.findMany({
      where: { isAdmin: false },
      orderBy: { points: "asc" },
      select: { id: true, points: true },
    });
    const minPoints = allNonAdmin[0]?.points ?? 0;
    const maxPoints = allNonAdmin[allNonAdmin.length - 1]?.points ?? 0;
    const isFattest = sacrificedPoints === maxPoints;
    const isMeekest = sacrificedPoints === minPoints;

    await prisma.$transaction(async (tx) => {
      // Zero out sacrificed player
      await tx.user.update({ where: { id: sacrificedId }, data: { points: 0 } });
      await tx.pointLog.create({ data: { userId: sacrificedId, amount: -sacrificedPoints, reason: "Sacrificed to The House by popular vote." } });

      // Distribute half to remaining players
      for (const p of remainingPlayers) {
        if (sharePerPlayer > 0) {
          await tx.user.update({ where: { id: p.id }, data: { points: { increment: sharePerPlayer } } });
          await tx.pointLog.create({ data: { userId: p.id, amount: sharePerPlayer, reason: `Sacrifice dividend — ${sacrificed.username} was offered to The House.` } });
        }
      }

      // Store sacrifice bonus as pending HP — added to the boss pool when it launches
      const bonusHp = Math.floor(houseHeal / 2); // half the pts taken, at 2:1 ratio
      await tx.houseConfig.upsert({
        where: { id: 1 },
        create: { id: 1, sacrificeOpen: false, sacrificeBonusHp: bonusHp },
        update: { sacrificeOpen: false, sacrificeBonusHp: { increment: bonusHp } },
      });
    });

    // Clear votes
    await prisma.sacrificeVote.deleteMany();

    // Achievement: Kill the Fatted Calf (most points)
    if (isFattest) {
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: sacrificedId, achievementId: "fatted_calf" } },
        // claimed at creation: the 500 pts are paid inline just below, so
        // leaving it claimable would pay the same reward a second time.
        create: { userId: sacrificedId, achievementId: "fatted_calf", claimed: true },
        update: {},
      });
      await prisma.user.update({ where: { id: sacrificedId }, data: { points: { increment: 500 } } });
      await log(sacrificedId, 500, "Achievement: Kill the Fatted Calf");
    }

    // Achievement: Suffer the Meek (least points) — mutually exclusive with fatted_calf
    if (isMeekest && !isFattest) {
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: sacrificedId, achievementId: "suffer_meek" } },
        // claimed at creation — see the note on fatted_calf above.
        create: { userId: sacrificedId, achievementId: "suffer_meek", claimed: true },
        update: {},
      });
      await prisma.user.update({ where: { id: sacrificedId }, data: { points: { increment: 300 } } });
      await log(sacrificedId, 300, "Achievement: Suffer the Meek");
    }

    return NextResponse.json({
      ok: true,
      username: sacrificed.username,
      sacrificedPoints,
      houseHeal,
      sharePerPlayer,
      playerCount: remainingPlayers.length,
      achievementAwarded: isFattest ? "fatted_calf" : isMeekest ? "suffer_meek" : null,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
