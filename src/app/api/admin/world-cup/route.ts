import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  // Parse body once — all fields destructured up front
  const body = await req.json().catch(() => ({}));
  const { action, adminLiveAt, playerLiveAt, eventEndAt, winningTeamId } = body;

  // Launch: set admin preview 12h before, player live at June 11 00:00 UTC
  if (action === "launch") {
    const pLiveAt = new Date("2026-06-11T00:00:00Z");
    const aLiveAt = new Date(pLiveAt.getTime() - 12 * 60 * 60 * 1000);
    const eEndAt = new Date("2026-07-20T00:00:00Z");
    const config = await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, worldCupAdminAt: aLiveAt, worldCupPlayerAt: pLiveAt, worldCupEventEndAt: eEndAt },
      update: { worldCupAdminAt: aLiveAt, worldCupPlayerAt: pLiveAt, worldCupEventEndAt: eEndAt },
    });
    return NextResponse.json({ ok: true, adminLiveAt: config.worldCupAdminAt, playerLiveAt: config.worldCupPlayerAt });
  }

  // Custom dates
  if (action === "setDates") {
    const config = await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, worldCupAdminAt: adminLiveAt ? new Date(adminLiveAt) : null, worldCupPlayerAt: playerLiveAt ? new Date(playerLiveAt) : null, worldCupEventEndAt: eventEndAt ? new Date(eventEndAt) : null },
      update: { worldCupAdminAt: adminLiveAt ? new Date(adminLiveAt) : null, worldCupPlayerAt: playerLiveAt ? new Date(playerLiveAt) : null, worldCupEventEndAt: eventEndAt ? new Date(eventEndAt) : null },
    });
    return NextResponse.json({ ok: true, adminLiveAt: config.worldCupAdminAt, playerLiveAt: config.worldCupPlayerAt });
  }

  // Close
  if (action === "close") {
    await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, worldCupAdminAt: null, worldCupPlayerAt: null },
      update: { worldCupAdminAt: null, worldCupPlayerAt: null },
    });
    return NextResponse.json({ ok: true });
  }

  // Distribute allegiance pool to winners
  if (action === "distributePool") {
    if (!winningTeamId) return NextResponse.json({ error: "winningTeamId required" }, { status: 400 });

    const winners = await prisma.worldCupEntry.findMany({ where: { teamId: winningTeamId } });
    const allEntries = await prisma.worldCupEntry.count();
    const totalPool = allEntries * 500;
    if (winners.length === 0) return NextResponse.json({ error: "No players backed that team" }, { status: 400 });

    const share = Math.floor(totalPool / winners.length);
    await prisma.$transaction(
      winners.map((w) => prisma.user.update({ where: { id: w.userId }, data: { points: { increment: share } } }))
    );

    return NextResponse.json({ ok: true, totalPool, winners: winners.length, sharePerWinner: share });
  }

  // Declare tournament champion — grants group_stage_prophet + 3 bonus Monitor Cans
  if (action === "declareChampion") {
    if (!winningTeamId) return NextResponse.json({ error: "winningTeamId required" }, { status: 400 });

    const winners = await prisma.worldCupEntry.findMany({ where: { teamId: winningTeamId } });
    if (winners.length === 0) return NextResponse.json({ error: "No players backed that team" }, { status: 400 });

    let rewarded = 0;
    for (const entry of winners) {
      const existing = await prisma.userAchievement.findUnique({
        where: { userId_achievementId: { userId: entry.userId, achievementId: "group_stage_prophet" } },
      });
      if (!existing) {
        await prisma.$transaction(async (tx) => {
          await tx.userAchievement.create({ data: { userId: entry.userId, achievementId: "group_stage_prophet" } });
          await tx.worldCupEntry.update({
            where: { userId: entry.userId },
            data: { monitorCans: { increment: 3 } },
          });
        });
        rewarded++;
      }
    }

    return NextResponse.json({ ok: true, championsFound: winners.length, rewarded });
  }

  // Pay out Fan Competition — top 2 fan scores split the pot 50/50
  if (action === "payFanCompetition") {
    const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
    const pot = config?.wcFanPot ?? 0;
    if (pot === 0) return NextResponse.json({ error: "Fan pot is empty" }, { status: 400 });

    const top2 = await prisma.worldCupEntry.findMany({
      where: { fanScore: { gt: 0 } },
      orderBy: { fanScore: "desc" },
      take: 2,
      include: { user: true },
    });
    if (top2.length === 0) return NextResponse.json({ error: "No fan scores recorded" }, { status: 400 });

    const firstShare = Math.floor(pot / 2);
    const secondShare = pot - firstShare; // catches odd-number rounding

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: top2[0].userId }, data: { points: { increment: firstShare } } });
      if (top2[1]) {
        await tx.user.update({ where: { id: top2[1].userId }, data: { points: { increment: secondShare } } });
      }
      await tx.houseConfig.update({ where: { id: 1 }, data: { wcFanPot: 0 } });
    });

    return NextResponse.json({
      ok: true,
      pot,
      first: { username: top2[0].user.username, fanScore: top2[0].fanScore, payout: firstShare },
      second: top2[1] ? { username: top2[1].user.username, fanScore: top2[1].fanScore, payout: secondShare } : null,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
