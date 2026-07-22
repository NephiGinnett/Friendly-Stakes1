import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  const pendingBets = await prisma.bigBet.findMany({
    where: { status: "pending" },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { stake: "desc" },
  });
  const approvedBet = await prisma.bigBet.findFirst({
    where: { status: "approved" },
    include: { user: { select: { id: true, username: true } } },
  });
  const completedBets = await prisma.bigBet.findMany({
    where: { status: "completed" },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { resolvedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    casinoNightActive: config?.casinoNightActive ?? false,
    casinoNightEndsAt: config?.casinoNightEndsAt ?? null,
    scratchJackpot: config?.scratchJackpot ?? 0,
    bigBetRevealAt: config?.bigBetRevealAt ?? null,
    bigBetGameType: config?.bigBetGameType ?? "",
    bigBetForce5x: config?.bigBetForce5x ?? false,
    pendingBets: pendingBets.map((b) => ({
      id: b.id, userId: b.userId, username: b.user.username, title: b.title,
      description: b.description, stake: b.stake, multiplier: b.multiplier,
      isAllIn: b.isAllIn, createdAt: b.createdAt,
    })),
    approvedBet: approvedBet ? {
      id: approvedBet.id, userId: approvedBet.userId, username: approvedBet.user.username,
      title: approvedBet.title, description: approvedBet.description,
      stake: approvedBet.stake, multiplier: approvedBet.multiplier, isAllIn: approvedBet.isAllIn,
    } : null,
    completedBets: completedBets.map((b) => ({
      id: b.id, username: b.user.username, title: b.title,
      stake: b.stake, outcome: b.outcome, payout: b.payout, multiplier: b.multiplier,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    action: string;
    active?: boolean;
    endsAt?: string;
    revealAt?: string;
    gameType?: string;
    betId?: number;
    outcome?: "win" | "loss";
    force5x?: boolean;
  };

  if (body.action === "toggle_casino") {
    await prisma.houseConfig.update({
      where: { id: 1 },
      data: {
        casinoNightActive: body.active ?? false,
        casinoNightEndsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_reveal_time") {
    await prisma.houseConfig.update({
      where: { id: 1 },
      data: { bigBetRevealAt: body.revealAt ? new Date(body.revealAt) : null },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_game_type") {
    const gt = body.gameType ?? "";
    await prisma.houseConfig.update({
      where: { id: 1 },
      data: { bigBetGameType: gt },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle_multiplier") {
    await prisma.houseConfig.update({
      where: { id: 1 },
      data: { bigBetForce5x: body.force5x ?? false },
    });
    return NextResponse.json({ ok: true });
  }

  // Approve one submission → refund all others
  if (body.action === "approve_bet") {
    const { betId } = body;
    if (!betId) return NextResponse.json({ error: "Missing betId" }, { status: 400 });

    const bet = await prisma.bigBet.findUnique({ where: { id: betId } });
    if (!bet || bet.status !== "pending") {
      return NextResponse.json({ error: "Bet not found or not pending" }, { status: 400 });
    }

    const alreadyApproved = await prisma.bigBet.findFirst({ where: { status: "approved" } });
    if (alreadyApproved) {
      return NextResponse.json({ error: "A bet is already approved for tonight" }, { status: 409 });
    }

    const otherPending = await prisma.bigBet.findMany({
      where: { status: "pending", id: { not: betId } },
    });

    // Grant the chosen VIP the exclusive Casino Night theme (kept site-wide).
    const vip = await prisma.user.findUnique({
      where: { id: bet.userId },
      select: { ownedThemes: true },
    });
    let vipThemes: string[] = [];
    try { vipThemes = JSON.parse(vip?.ownedThemes || "[]"); } catch { /* */ }
    const themeNewlyAwarded = !vipThemes.includes("casino-night");
    if (themeNewlyAwarded) vipThemes.push("casino-night");

    await prisma.$transaction(async (tx) => {
      await tx.bigBet.update({ where: { id: betId }, data: { status: "approved" } });

      if (themeNewlyAwarded) {
        await tx.user.update({
          where: { id: bet.userId },
          data: { ownedThemes: JSON.stringify(vipThemes), siteTheme: "casino-night" },
        });
      }

      for (const other of otherPending) {
        await tx.bigBet.update({ where: { id: other.id }, data: { status: "refunded" } });
        await tx.user.update({ where: { id: other.userId }, data: { points: { increment: other.stake } } });
        await logPoints(tx, other.userId, other.stake, `Big Bet Show — submission refunded (not selected)`);
      }
    });

    return NextResponse.json({ ok: true, refunded: otherPending.length, themeAwarded: themeNewlyAwarded });
  }

  // Admin completes the live game — records outcome and pays out
  if (body.action === "complete_bet") {
    const { betId, outcome } = body;
    if (!betId || !outcome) return NextResponse.json({ error: "Missing betId or outcome" }, { status: 400 });

    const bet = await prisma.bigBet.findUnique({ where: { id: betId } });
    if (!bet || bet.status !== "approved") {
      return NextResponse.json({ error: "Bet not found or not approved" }, { status: 400 });
    }

    const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
    const effectiveMultiplier = config?.bigBetForce5x ? 5.0 : bet.multiplier;
    const payout = outcome === "win" ? Math.floor(bet.stake * effectiveMultiplier) : 0;

    await prisma.$transaction(async (tx) => {
      await tx.bigBet.update({
        where: { id: betId },
        data: { outcome, payout, multiplier: effectiveMultiplier, status: "completed", resolvedAt: new Date() },
      });

      if (outcome === "win" && payout > 0) {
        await tx.user.update({ where: { id: bet.userId }, data: { points: { increment: payout } } });
        await logPoints(tx, bet.userId, payout, `Strike It Rich WIN (×${effectiveMultiplier})`);
      }
    });

    return NextResponse.json({ ok: true, payout });
  }

  // Refund a single pending bet manually
  if (body.action === "refund_bet") {
    const { betId } = body;
    if (!betId) return NextResponse.json({ error: "Missing betId" }, { status: 400 });

    const bet = await prisma.bigBet.findUnique({ where: { id: betId } });
    if (!bet || !["pending", "approved"].includes(bet.status)) {
      return NextResponse.json({ error: "Bet not found or already resolved" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bigBet.update({ where: { id: betId }, data: { status: "refunded" } });
      await tx.user.update({ where: { id: bet.userId }, data: { points: { increment: bet.stake } } });
      await logPoints(tx, bet.userId, bet.stake, `Big Bet Show — submission refunded by admin`);
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
