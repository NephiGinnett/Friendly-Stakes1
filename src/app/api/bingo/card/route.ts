import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let squares = await prisma.bingoSquare.findMany({
    where: { userId: user.id },
    include: { bingoItem: true },
    orderBy: { position: "asc" },
  });

  // Auto-generate card if the user has none
  if (squares.length === 0) {
    const items = await prisma.bingoItem.findMany();
    if (items.length < 25) {
      return NextResponse.json({ squares: [], needsItems: true });
    }

    const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 25);
    await prisma.bingoSquare.createMany({
      data: shuffled.map((item, i) => ({
        userId: user.id,
        bingoItemId: item.id,
        position: i,
        claimStatus: "none",
      })),
    });

    squares = await prisma.bingoSquare.findMany({
      where: { userId: user.id },
      include: { bingoItem: true },
      orderBy: { position: "asc" },
    });
  }

  return NextResponse.json({
    squares: squares.map((s) => ({
      id: s.id,
      position: s.position,
      text: s.bingoItem.text,
      providerName: s.bingoItem.providerName,
      claimStatus: s.claimStatus,
      claimedAt: s.claimedAt,
    })),
    needsItems: false,
  });
}
