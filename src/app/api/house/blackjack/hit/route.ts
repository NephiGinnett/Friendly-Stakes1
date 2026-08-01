import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handValue } from "@/lib/house";
import { log } from "@/lib/pointLog";
import { healBoss } from "@/lib/bossHeal";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.blackjackGame.findUnique({ where: { userId: user.id } });
  if (!game || game.status !== "active") {
    return NextResponse.json({ error: "No active game." }, { status: 404 });
  }

  const playerHand: string[] = JSON.parse(game.playerHand);
  const dealerHand: string[] = JSON.parse(game.dealerHand);
  const deck: string[] = JSON.parse(game.deck);

  const newCard = deck.pop()!;
  playerHand.push(newCard);

  const pv = handValue(playerHand);
  let status = "active";
  let payout = 0;

  if (pv > 21) {
    status = "player_bust";
    // bet already deducted at start — no payout
  }

  await prisma.blackjackGame.update({
    where: { userId: user.id },
    data: {
      playerHand: JSON.stringify(playerHand),
      deck: JSON.stringify(deck),
      status,
    },
  });

  if (status === "player_bust") {
    await log(user.id, 0, `Blackjack: bust (${pv}), lost ${game.bet} pts`);

    // Phase 4: bust heals the boss
    await healBoss(game.bet);
  }

  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });

  return NextResponse.json({
    game: {
      playerHand,
      dealerHand: status === "active" ? [dealerHand[0], "??"] : dealerHand,
      playerValue: pv,
      dealerValue: handValue([dealerHand[0]]),
      dealerFullValue: handValue(dealerHand),
      bet: game.bet,
      status,
    },
    newPoints: updated!.points,
    payout,
  });
}
