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
    const { proposedStake, wantCreatorStake, message } = await req.json();
    const wagerId = parseInt(params.id);

    const wager = await prisma.wager.findUnique({ where: { id: wagerId } });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "open") return NextResponse.json({ error: "Wager is not open" }, { status: 400 });
    if (wager.creatorId === user.id) return NextResponse.json({ error: "Can't counter your own wager" }, { status: 400 });

    if (!proposedStake || proposedStake < 1) {
      return NextResponse.json({ error: "Your proposed stake must be at least 1" }, { status: 400 });
    }
    if (!wantCreatorStake || wantCreatorStake < 1) {
      return NextResponse.json({ error: "Requested creator stake must be at least 1" }, { status: 400 });
    }

    const counter = await prisma.counterOffer.create({
      data: {
        wagerId,
        userId: user.id,
        proposedStake,
        wantCreatorStake,
        message: message || null,
      },
    });

    return NextResponse.json(counter, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Accept a counter-offer (by the wager creator)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { counterOfferId, action } = await req.json();
    const wagerId = parseInt(params.id);

    const wager = await prisma.wager.findUnique({ where: { id: wagerId } });
    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.creatorId !== user.id) return NextResponse.json({ error: "Only the creator can respond" }, { status: 403 });

    const counter = await prisma.counterOffer.findUnique({
      where: { id: counterOfferId },
    });
    if (!counter || counter.wagerId !== wagerId) {
      return NextResponse.json({ error: "Counter-offer not found" }, { status: 404 });
    }

    if (action === "accept") {
      const counterUser = await prisma.user.findUnique({ where: { id: counter.userId } });
      if (!counterUser || counterUser.points < counter.proposedStake) {
        return NextResponse.json({ error: "Counter-offerer doesn't have enough points" }, { status: 400 });
      }

      // Refund original stake difference if creator stake changed
      const stakeDiff = counter.wantCreatorStake - wager.creatorStake;

      await prisma.$transaction([
        // Update wager
        prisma.wager.update({
          where: { id: wagerId },
          data: {
            creatorStake: counter.wantCreatorStake,
            acceptorId: counter.userId,
            acceptorStake: counter.proposedStake,
            status: "accepted",
          },
        }),
        // Adjust creator points for stake change
        ...(stakeDiff > 0
          ? [prisma.user.update({ where: { id: user.id }, data: { points: { decrement: stakeDiff } } })]
          : stakeDiff < 0
          ? [prisma.user.update({ where: { id: user.id }, data: { points: { increment: Math.abs(stakeDiff) } } })]
          : []),
        // Deduct acceptor points
        prisma.user.update({
          where: { id: counter.userId },
          data: { points: { decrement: counter.proposedStake } },
        }),
        // Mark counter as accepted, reject others
        prisma.counterOffer.update({ where: { id: counterOfferId }, data: { status: "accepted" } }),
        prisma.counterOffer.updateMany({
          where: { wagerId, id: { not: counterOfferId }, status: "pending" },
          data: { status: "rejected" },
        }),
      ]);

      return NextResponse.json({ ok: true });
    } else {
      await prisma.counterOffer.update({
        where: { id: counterOfferId },
        data: { status: "rejected" },
      });
      return NextResponse.json({ ok: true });
    }
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
