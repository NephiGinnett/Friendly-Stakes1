import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { doSettle, checkThumbAchievement } from "@/lib/settle";


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
      include: { votes: true, entries: true },
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
      await checkThumbAchievement(user.id);
    }

    // Auto-settle once 2+ (weighted) votes agree on one side — matching the
    // stated rule. A Thumb on the Scale makes a single vote weigh 2, so it can
    // settle on its own; otherwise two agreeing votes do it. The leading side
    // must strictly exceed the other so a 2–2 split waits for a tiebreaker.
    const allVotes = await prisma.vote.findMany({ where: { wagerId } });
    const SETTLE_AT = 2;
    const forWeight = allVotes.filter((v) => v.choice === "for").reduce((sum, v) => sum + v.weight, 0);
    const againstWeight = allVotes.filter((v) => v.choice === "against").reduce((sum, v) => sum + v.weight, 0);

    if (forWeight >= SETTLE_AT && forWeight > againstWeight) {
      await doSettle(wagerId, "for", "vote");
    } else if (againstWeight >= SETTLE_AT && againstWeight > forWeight) {
      await doSettle(wagerId, "against", "vote");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
