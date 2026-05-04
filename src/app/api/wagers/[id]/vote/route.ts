import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const MIN_VOTES_TO_SETTLE = 2;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { choice } = await req.json(); // "creator" or "acceptor"
    const wagerId = parseInt(params.id);

    if (choice !== "creator" && choice !== "acceptor") {
      return NextResponse.json({ error: "Choice must be 'creator' or 'acceptor'" }, { status: 400 });
    }

    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { votes: true },
    });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "voting" && wager.status !== "accepted") {
      return NextResponse.json({ error: "Wager is not open for voting" }, { status: 400 });
    }

    // Create or update vote
    await prisma.vote.upsert({
      where: { wagerId_userId: { wagerId, userId: user.id } },
      create: { wagerId, userId: user.id, choice },
      update: { choice },
    });

    // Check if auto-settle is possible
    const allVotes = await prisma.vote.findMany({ where: { wagerId } });

    if (allVotes.length >= MIN_VOTES_TO_SETTLE) {
      const creatorVotes = allVotes.filter((v) => v.choice === "creator").length;
      const acceptorVotes = allVotes.filter((v) => v.choice === "acceptor").length;

      // Need a clear majority
      if (creatorVotes > acceptorVotes && creatorVotes > allVotes.length / 2) {
        await settleWager(wager, wager.creatorId, "vote");
      } else if (acceptorVotes > creatorVotes && acceptorVotes > allVotes.length / 2) {
        await settleWager(wager, wager.acceptorId!, "vote");
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

async function settleWager(
  wager: { id: number; creatorId: number; creatorStake: number; acceptorId: number | null; acceptorStake: number | null },
  winnerId: number,
  method: string
) {
  const totalPool = wager.creatorStake + (wager.acceptorStake || 0);

  await prisma.$transaction([
    prisma.wager.update({
      where: { id: wager.id },
      data: {
        status: "settled",
        winnerId,
        settledAt: new Date(),
        settledBy: method,
      },
    }),
    prisma.user.update({
      where: { id: winnerId },
      data: { points: { increment: totalPool } },
    }),
  ]);
}
