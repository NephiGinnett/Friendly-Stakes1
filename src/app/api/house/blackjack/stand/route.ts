import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handValue } from "@/lib/house";
import { log } from "@/lib/pointLog";

async function runDealer(game: { userId: number; playerHand: string; dealerHand: string; deck: string; bet: number }) {
  const playerHand: string[] = JSON.parse(game.playerHand);
  const dealerHand: string[] = JSON.parse(game.dealerHand);
  const deck: string[] = JSON.parse(game.deck);

  // Dealer draws until 17+
  while (handValue(dealerHand) < 17) {
    dealerHand.push(deck.pop()!);
  }

  const pv = handValue(playerHand);
  const dv = handValue(dealerHand);

  let status: string;
  let payout = 0;

  if (dv > 21) {
    status = "dealer_bust";
    payout = game.bet * 2;
  } else if (pv > dv) {
    status = "player_win";
    payout = game.bet * 2;
  } else if (dv > pv) {
    status = "dealer_win";
    payout = 0;
  } else {
    status = "push";
    payout = game.bet;
  }

  await prisma.blackjackGame.update({
    where: { userId: game.userId },
    data: { dealerHand: JSON.stringify(dealerHand), deck: JSON.stringify(deck), status },
  });

  if (payout > 0) {
    await prisma.user.update({ where: { id: game.userId }, data: { points: { increment: payout } } });
  }

  const net = payout - game.bet;
  if (status !== "push") {
    await log(game.userId, net, `Blackjack: ${status.replace("_", " ")} (player ${pv} vs dealer ${dv})`);
  }

  const updated = await prisma.user.findUnique({ where: { id: game.userId }, select: { points: true } });

  return { playerHand, dealerHand, playerValue: pv, dealerValue: dv, bet: game.bet, status, newPoints: updated!.points, payout };
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.blackjackGame.findUnique({ where: { userId: user.id } });
  if (!game || game.status !== "active") {
    return NextResponse.json({ error: "No active game." }, { status: 404 });
  }

  const result = await runDealer(game);
  return NextResponse.json({ game: result, newPoints: result.newPoints });
}
