import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { doSettle } from "@/lib/settle";

const MIN_VOTES_TO_SETTLE = 2;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { choice, useThumb } = await req.json();
    const wagerId = parseInt(params.id);

    if (choice !== "for" && choice !== "against") {
      return NextResponse.json({ error: "Choice must be 'for' or 'against'" }, { status: 400 });
    }

    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { votes: true },
    });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "voting") {
      return NextResponse.json({ error: "Wager is not open for voting" }, { status: 400 });
    }

    // Check for thumb-on-the-scale usage
    let weight = 1;
    let thumbItemId: number | null = null;
    if (useThumb) {
      const thumbItem = await prisma.userItem.findFirst({
        where: { userId: user.id, itemType: "thumb", usesLeft: { gt: 0 } },
      });
      if (thumbItem) {
        weight = 2;
        thumbItemId = thumbItem.id;
      }
    }

    await prisma.vote.upsert({
      where: { wagerId_userId: { wagerId, userId: user.id } },
      create: { wagerId, userId: user.id, choice, weight },
      update: { choice, weight },
    });

    if (thumbItemId) {
      await prisma.userItem.update({
        where: { id: thumbItemId },
        data: { usesLeft: { decrement: 1 } },
      });
    }

    // Auto-settle: tally by weight, not count
    const allVotes = await prisma.vote.findMany({ where: { wagerId } });
    const totalWeight = allVotes.reduce((sum, v) => sum + v.weight, 0);
    const forWeight = allVotes.filter((v) => v.choice === "for").reduce((sum, v) => sum + v.weight, 0);
    const againstWeight = allVotes.filter((v) => v.choice === "against").reduce((sum, v) => sum + v.weight, 0);

    if (totalWeight >= MIN_VOTES_TO_SETTLE) {
      if (forWeight > againstWeight && forWeight > totalWeight / 2) {
        await doSettle(wagerId, "for", "vote");
      } else if (againstWeight > forWeight && againstWeight > totalWeight / 2) {
        await doSettle(wagerId, "against", "vote");
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
