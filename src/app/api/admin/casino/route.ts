import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { CASINO_PAGES } from "@/lib/discovery";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  const pendingBets = await prisma.bigBet.findMany({
    where: { status: "pending" },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
  });
  const resolvedBets = await prisma.bigBet.findMany({
    where: { status: "resolved" },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    casinoNightActive: config?.casinoNightActive ?? false,
    casinoNightEndsAt: config?.casinoNightEndsAt ?? null,
    scratchJackpot: config?.scratchJackpot ?? 0,
    bigBetRevealAt: config?.bigBetRevealAt ?? null,
    pendingBets: pendingBets.map((b) => ({
      id: b.id, username: b.user.username, title: b.title,
      description: b.description, stake: b.stake, multiplier: b.multiplier,
    })),
    resolvedBets: resolvedBets.map((b) => ({
      id: b.id, username: b.user.username, title: b.title,
      description: b.description, stake: b.stake, outcome: b.outcome, payout: b.payout,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    action: "toggle_casino" | "set_reveal_time" | "resolve_bet" | "reveal_all";
    active?: boolean;
    endsAt?: string;
    revealAt?: string;
    betId?: number;
    outcome?: "win" | "loss";
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

  if (body.action === "resolve_bet") {
    const { betId, outcome } = body;
    if (!betId || !outcome) return NextResponse.json({ error: "Missing betId or outcome" }, { status: 400 });

    const bet = await prisma.bigBet.findUnique({ where: { id: betId } });
    if (!bet || bet.status !== "pending") {
      return NextResponse.json({ error: "Bet not found or already resolved" }, { status: 400 });
    }

    const payout = outcome === "win" ? Math.floor(bet.stake * bet.multiplier) : 0;

    await prisma.bigBet.update({
      where: { id: betId },
      data: { outcome, payout, status: "resolved", resolvedAt: new Date() },
    });

    return NextResponse.json({ ok: true, payout });
  }

  if (body.action === "reveal_all") {
    const resolved = await prisma.bigBet.findMany({ where: { status: "resolved" } });

    await prisma.$transaction(async (tx) => {
      for (const bet of resolved) {
        await tx.bigBet.update({
          where: { id: bet.id },
          data: { status: "revealed", revealAt: new Date() },
        });
        if (bet.outcome === "win" && bet.payout > 0) {
          await tx.user.update({
            where: { id: bet.userId },
            data: { points: { increment: bet.payout } },
          });
          await logPoints(
            tx,
            bet.userId,
            bet.payout,
            `Big Bet Show WIN — "${bet.title}" (×${bet.multiplier})`
          );

          // Achievement: first Big Bet Show win
          const existing = await tx.userAchievement.findUnique({
            where: { userId_achievementId: { userId: bet.userId, achievementId: "big_bet_winner" } },
          });
          if (!existing) {
            await tx.userAchievement.create({ data: { userId: bet.userId, achievementId: "big_bet_winner" } });
            await tx.user.update({ where: { id: bet.userId }, data: { points: { increment: 250 } } });
            await logPoints(tx, bet.userId, 250, `Achievement unlocked: The Numbers Spoke`);
          }
        }
      }
    });

    return NextResponse.json({ ok: true, revealed: resolved.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
