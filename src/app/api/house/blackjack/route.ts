import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handValue } from "@/lib/house";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.blackjackGame.findUnique({ where: { userId: user.id } });
  if (!game) return NextResponse.json({ game: null, playsRemaining: 3 });

  const playerHand: string[] = JSON.parse(game.playerHand);
  const dealerHand: string[] = JSON.parse(game.dealerHand);
  const isActive = game.status === "active";

  // Compute today's remaining plays from the stored daily counters
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const playsToday = game.dailyDate === todayStr ? game.dailyPlays : 0;

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
    playsRemaining: Math.max(0, 3 - playsToday),
  });
}
