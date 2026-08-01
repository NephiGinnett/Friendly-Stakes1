import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildDeck, handValue, isNaturalBlackjack, HOUSE_PHASES } from "@/lib/house";
import { log } from "@/lib/pointLog";
import { todayUtcDate, isStrikeWindow } from "@/lib/houseStrike";
import { NOISE_SOURCE } from "@/lib/houseLog";

const DAILY_LIMIT = 3;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.upsert({
    where: { id: 1 }, create: { id: 1, phase: 0 }, update: {},
  });
  const phase = config.phase as 0 | 1 | 2 | 3 | 4;
  // Phase 4 bypasses the blackjackLocked gate — games still run, losses heal the boss
  if (HOUSE_PHASES[phase].blackjackLocked && phase !== 4) {
    return NextResponse.json({ error: "The table is closed." }, { status: 403 });
  }

  if (!config.casinoOpen) {
    return NextResponse.json({ error: "ACCESS RESTRICTED. The casino floor has been sealed for recalibration. Your presence here has been logged. Re-opens: Friday." }, { status: 403 });
  }

  const existing = await prisma.blackjackGame.findUnique({ where: { userId: user.id } });

  if (user.houseBanDate === todayUtcDate()) {
    return NextResponse.json({ error: "The House has revoked your table privileges today. You shouldn't have woken it." }, { status: 403 });
  }

  if (existing?.status === "active") {
    return NextResponse.json({ error: "You already have an active game." }, { status: 409 });
  }

  // Check daily limit
  const today = todayUtcDate();
  const playsToday = existing?.dailyDate === today ? existing.dailyPlays : 0;
  if (playsToday >= DAILY_LIMIT) {
    return NextResponse.json({ error: `You've played ${DAILY_LIMIT} hands today. Come back tomorrow.` }, { status: 429 });
  }

  const { bet } = await req.json();
  if (!bet || bet < 50) return NextResponse.json({ error: "Minimum bet is 50 pts." }, { status: 400 });
  if (bet > user.points) return NextResponse.json({ error: "Not enough points." }, { status: 400 });

  const deck = buildDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  await prisma.user.update({ where: { id: user.id }, data: { points: { decrement: bet } } });
  await log(user.id, -bet, `Blackjack: placed bet of ${bet} pts`);

  // Playing during sleep window counts as noise — adds to wake chance
  if (!isStrikeWindow()) {
    await prisma.houseDamageLog.create({ data: { userId: user.id, amount: 25, source: NOISE_SOURCE } });
  }

  let status = "active";
  let payout = 0;

  if (isNaturalBlackjack(playerHand)) {
    status = "blackjack";
    payout = bet + Math.floor(bet * 1.5);
  }

  const newDailyPlays = (existing?.dailyDate === today ? (existing.dailyPlays ?? 0) : 0) + 1;

  const game = await prisma.blackjackGame.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      playerHand: JSON.stringify(playerHand),
      dealerHand: JSON.stringify(dealerHand),
      deck: JSON.stringify(deck),
      bet,
      status,
      dailyPlays: newDailyPlays,
      dailyDate: today,
    },
    update: {
      playerHand: JSON.stringify(playerHand),
      dealerHand: JSON.stringify(dealerHand),
      deck: JSON.stringify(deck),
      bet,
      status,
      dailyPlays: newDailyPlays,
      dailyDate: today,
    },
  });

  if (payout > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { points: { increment: payout } } });
    await log(user.id, payout - bet, `Blackjack: natural blackjack! Won ${payout - bet} pts`);
  }

  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });

  return NextResponse.json({
    game: {
      id: game.id,
      playerHand,
      dealerHand: status === "active" ? [dealerHand[0], "??"] : dealerHand,
      playerValue: handValue(playerHand),
      dealerValue: handValue([dealerHand[0]]),
      dealerFullValue: handValue(dealerHand),
      bet,
      status,
    },
    newPoints: updated!.points,
    playsRemaining: DAILY_LIMIT - newDailyPlays,
  });
}
