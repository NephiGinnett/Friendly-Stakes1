import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { stake } = await req.json();
    const wagerId = parseInt(params.id);

    const wager = await prisma.wager.findUnique({ where: { id: wagerId } });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "open") return NextResponse.json({ error: "Wager is not open" }, { status: 400 });
    if (wager.creatorId === user.id) return NextResponse.json({ error: "Can't accept your own wager" }, { status: 400 });

    if (!stake || stake < 1) return NextResponse.json({ error: "Stake must be at least 1" }, { status: 400 });
    if (stake > user.points) return NextResponse.json({ error: "Not enough points" }, { status: 400 });

    await prisma.$transaction([
      prisma.wager.update({
        where: { id: wagerId },
        data: {
          acceptorId: user.id,
          acceptorStake: stake,
          status: "accepted",
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { points: { decrement: stake } },
      }),
      // Reject all pending counter-offers
      prisma.counterOffer.updateMany({
        where: { wagerId, status: "pending" },
        data: { status: "rejected" },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
