import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const pending = await prisma.bingoSquare.findMany({
    where: { claimStatus: "pending" },
    include: {
      user: { select: { username: true } },
      bingoItem: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    pending.map((s) => ({
      id: s.id,
      username: s.user.username,
      position: s.position,
      text: s.bingoItem.text,
      providerName: s.bingoItem.providerName,
      claimNote: s.claimNote ?? null,
    }))
  );
}
