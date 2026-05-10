import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await prisma.user.findUnique({
    where: { username: params.username.toLowerCase() },
    select: { id: true, username: true, points: true, isAdmin: true },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wagers = await prisma.wager.findMany({
    where: {
      OR: [
        { creatorId: player.id },
        { entries: { some: { userId: player.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, username: true } },
      entries: { select: { userId: true, side: true, stake: true } },
    },
  });

  return NextResponse.json({ player, wagers });
}
