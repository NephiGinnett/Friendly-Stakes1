import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handValue } from "@/lib/house";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.blackjackGame.findUnique({ where: { userId: user.id } });
  if (!game) return NextResponse.json({ game: null });

  const playerHand: string[] = JSON.parse(game.playerHand);
  const dealerHand: string[] = JSON.parse(game.dealerHand);
  const isActive = game.status === "active";

  return NextResponse.json({
    game: {
      id: game.id,
      playerHand,
      dealerHand: isActive ? [dealerHand[0], "??"] : dealerHand,
      playerValue: handValue(playerHand),
      dealerValue: isActive ? handValue([dealerHand[0]]) : handValue(dealerHand),
      dealerFullValue: handValue(dealerHand),
      bet: game.bet,
      status: game.status,
    },
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.blackjackGame.findUnique({ where: { userId: user.id } });
  if (game && game.status === "active") {
    return NextResponse.json({ error: "Cannot clear an active game" }, { status: 409 });
  }
  if (game) await prisma.blackjackGame.delete({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
