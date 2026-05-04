import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Admin settle (override)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const { winnerId } = await req.json();
    const wagerId = parseInt(params.id);

    const wager = await prisma.wager.findUnique({ where: { id: wagerId } });
    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });

    if (wager.status === "settled" || wager.status === "cancelled") {
      return NextResponse.json({ error: "Wager already resolved" }, { status: 400 });
    }

    if (winnerId !== wager.creatorId && winnerId !== wager.acceptorId) {
      return NextResponse.json({ error: "Winner must be creator or acceptor" }, { status: 400 });
    }

    const totalPool = wager.creatorStake + (wager.acceptorStake || 0);

    await prisma.$transaction([
      prisma.wager.update({
        where: { id: wagerId },
        data: {
          status: "settled",
          winnerId,
          settledAt: new Date(),
          settledBy: "admin",
        },
      }),
      prisma.user.update({
        where: { id: winnerId },
        data: { points: { increment: totalPool } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
