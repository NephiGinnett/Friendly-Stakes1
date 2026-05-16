import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// 1 token = 10 points
const RATE = 10;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount } = await req.json(); // 1, 5, or 10 tokens
  if (![1, 5, 10].includes(amount)) return NextResponse.json({ error: "Amount must be 1, 5, or 10" }, { status: 400 });

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { bookmarkTokens: true } });
  if (!fullUser || fullUser.bookmarkTokens < amount) {
    return NextResponse.json({ error: "Not enough Bookmark Tokens" }, { status: 400 });
  }

  const pointsGained = amount * RATE;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { bookmarkTokens: { decrement: amount }, points: { increment: pointsGained } },
    });
    await tx.pointLog.create({
      data: { userId: user.id, amount: pointsGained, reason: `AR Faire: traded ${amount} 🔖 for ${pointsGained} pts` },
    });
  });

  return NextResponse.json({ ok: true, pointsGained });
}
