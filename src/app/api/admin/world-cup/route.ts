import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const ROUND_EXPECTED: Record<string, number> = { R32: 16, R16: 8, QF: 4, SF: 2, FINAL: 1 };
const ROUNDS = ["R32", "R16", "QF", "SF", "FINAL"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const [config, slots, teams, entryCount, pickCounts, adminEntry, eliminatedCount] = await Promise.all([
    prisma.houseConfig.findUnique({ where: { id: 1 } }),
    prisma.bracketSlot.findMany({ orderBy: [{ round: "asc" }, { position: "asc" }] }),
    prisma.worldCupTeam.findMany({ select: { id: true, code: true, name: true, flag: true, eliminated: true } }),
    prisma.worldCupEntry.count(),
    prisma.bracketPick.groupBy({ by: ["round"], _count: { id: true } }),
    prisma.worldCupEntry.findUnique({ where: { userId: user.id } }),
    prisma.worldCupTeam.count({ where: { eliminated: true } }),
  ]);

  const now = new Date();
  const locked = !!(config?.bracketLockedAt && now >= config.bracketLockedAt);

  // Unique players who have at least one pick
  const pickerCount = await prisma.bracketPick.findMany({ select: { userId: true }, distinct: ["userId"] });

  const byRound = Object.fromEntries(
    ROUNDS.map((r) => {
      const roundSlots = slots.filter((s) => s.round === r);
      const pickRow = pickCounts.find((p) => p.round === r);
      return [r, { slots: roundSlots, slotCount: roundSlots.length, expected: ROUND_EXPECTED[r], pickCount: pickRow?._count.id ?? 0 }];
    })
  );

  return NextResponse.json({
    locked,
    bracketLockedAt: config?.bracketLockedAt ?? null,
    worldCupAdminAt: config?.worldCupAdminAt ?? null,
    worldCupPlayerAt: config?.worldCupPlayerAt ?? null,
    entryCount,
    pickerCount: pickerCount.length,
    byRound,
    teams,
    eliminatedCount,
    adminHasEntry: !!adminEntry,
  });
}

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
    if (winners.length === 0) return NextResponse.json({ error: "No players backed that team" }, { status: 400 });
    const poolSum = await prisma.worldCupEntry.aggregate({ _sum: { paid: true, proxyPaid: true } });
    const totalPool = (poolSum._sum.paid ?? 0) + (poolSum._sum.proxyPaid ?? 0);

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

  // Lock bracket immediately
  if (action === "lockBracket") {
    await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, bracketLockedAt: new Date() },
      update: { bracketLockedAt: new Date() },
    });
    return NextResponse.json({ ok: true, bracketLockedAt: new Date() });
  }

  // Unlock bracket
  if (action === "unlockBracket") {
    await prisma.houseConfig.upsert({
      where: { id: 1 },
      create: { id: 1, bracketLockedAt: null },
      update: { bracketLockedAt: null },
    });
    return NextResponse.json({ ok: true, bracketLockedAt: null });
  }

  // Manually seed (upsert) a single bracket slot
  if (action === "seedSlot") {
    const { round, position, team1Code, team2Code, winnerCode: wCode } = body;
    if (!round || position == null || !team1Code || !team2Code) {
      return NextResponse.json({ error: "round, position, team1Code, team2Code required" }, { status: 400 });
    }
    const slot = await prisma.bracketSlot.upsert({
      where: { round_position: { round, position } },
      create: { round, position, team1Code, team2Code, winnerCode: wCode ?? "" },
      update: { team1Code, team2Code, ...(wCode !== undefined ? { winnerCode: wCode } : {}) },
    });
    return NextResponse.json({ ok: true, slot });
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

  // Remove admin's own test entry so they can re-enter or clean up before launch
  if (action === "resetEntry") {
    const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
    if (!entry) return NextResponse.json({ error: "No entry to remove" }, { status: 404 });
    await prisma.worldCupEntry.delete({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  }

  // Mark a team as eliminated (triggers proxy feature for that team's player)
  if (action === "eliminateTeam") {
    const { teamId: elimTeamId } = body;
    if (!elimTeamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
    await prisma.worldCupTeam.update({ where: { id: elimTeamId }, data: { eliminated: true } });
    return NextResponse.json({ ok: true });
  }

  // Restore a team (undo elimination — e.g. admin error)
  if (action === "restoreTeam") {
    const { teamId: restoreTeamId } = body;
    if (!restoreTeamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
    await prisma.worldCupTeam.update({ where: { id: restoreTeamId }, data: { eliminated: false } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
