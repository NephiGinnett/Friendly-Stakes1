import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { GAME_REGISTRY } from "@/lib/gameRegistry";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { gameId } = await req.json();
  if (!GAME_REGISTRY[gameId as keyof typeof GAME_REGISTRY]) {
    return NextResponse.json({ error: "Unknown game" }, { status: 400 });
  }

  const session = await prisma.gameSession.create({
    data: { userId: user.id, gameId },
  });

  return NextResponse.json({ sessionId: session.id });
}
