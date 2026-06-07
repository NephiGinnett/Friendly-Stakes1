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

    // Auto-settle: a side wins when its weighted votes exceed half of all participants.
    // totalParticipants = creator (1) + all entries, matching who can actually vote.
    const allVotes = await prisma.vote.findMany({ where: { wagerId } });
    const totalParticipants = 1 + wager.entries.length;
    const majorityThreshold = totalParticipants / 2;
    const forWeight = allVotes.filter((v) => v.choice === "for").reduce((sum, v) => sum + v.weight, 0);
    const againstWeight = allVotes.filter((v) => v.choice === "against").reduce((sum, v) => sum + v.weight, 0);

    if (forWeight > majorityThreshold) {
      await doSettle(wagerId, "for", "vote");
    } else if (againstWeight > majorityThreshold) {
      await doSettle(wagerId, "against", "vote");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
