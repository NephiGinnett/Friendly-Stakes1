import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** GET — return current sacrifice vote state */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.sacrificeOpen) {
    return NextResponse.json({ open: false, votes: [], myVote: null });
  }

  const allVotes = await prisma.sacrificeVote.findMany({
    include: {
      target: { select: { id: true, username: true } },
      voter: { select: { id: true, username: true } },
    },
  });

  // Tally weighted votes per target
  const tally: Record<number, { username: string; votes: number }> = {};
  for (const v of allVotes) {
    if (!tally[v.targetId]) tally[v.targetId] = { username: v.target.username, votes: 0 };
    tally[v.targetId].votes += v.weight;
  }

  const votes = Object.entries(tally)
    .map(([id, d]) => ({ userId: Number(id), username: d.username, votes: d.votes }))
    .sort((a, b) => b.votes - a.votes);

  const myVoteRow = allVotes.find(v => v.voterId === user.id);
  const myVote = myVoteRow ? { targetId: myVoteRow.targetId, targetUsername: myVoteRow.target.username, weight: myVoteRow.weight } : null;

  const voterIds = new Set(allVotes.map(v => v.voterId));

  return NextResponse.json({ open: true, votes, myVote, voterCount: voterIds.size });
}

/** POST — cast or change a vote */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isAdmin) return NextResponse.json({ error: "Admins cannot vote." }, { status: 403 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.sacrificeOpen) return NextResponse.json({ error: "Sacrifice vote is not open." }, { status: 400 });

  const { targetUsername, useThumb } = await req.json();
  if (!targetUsername) return NextResponse.json({ error: "Target required." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { username: targetUsername.toLowerCase() } });
  if (!target) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  if (target.isAdmin) return NextResponse.json({ error: "Cannot sacrifice an admin." }, { status: 400 });

  let weight = 1;

  // Thumb on the Scale: consume one charge for 2x vote weight
  if (useThumb) {
    const thumb = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType: "thumb", usesLeft: { gt: 0 } },
    });
    if (!thumb) return NextResponse.json({ error: "You don't have Thumb on the Scale." }, { status: 403 });
    await prisma.userItem.update({ where: { id: thumb.id }, data: { usesLeft: { decrement: 1 } } });
    weight = 2;
  }

  // Upsert: one vote per voter, replaceable
  await prisma.sacrificeVote.upsert({
    where: { voterId: user.id },
    create: { voterId: user.id, targetId: target.id, weight },
    update: { targetId: target.id, weight },
  });

  return NextResponse.json({ ok: true, targetUsername: target.username, weight });
}
