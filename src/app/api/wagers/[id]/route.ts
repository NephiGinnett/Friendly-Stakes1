import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { maskWager } from "@/lib/vpn";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wager = await prisma.wager.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      creator: { select: { id: true, username: true } },
      entries: {
        include: { user: { select: { id: true, username: true } } },
        orderBy: { createdAt: "asc" },
      },
      votes: {
        include: { user: { select: { id: true, username: true } } },
      },
      botEntries: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!wager) {
    return NextResponse.json({ error: "Wager not found" }, { status: 404 });
  }

  return NextResponse.json(maskWager(wager, user.id));
}
