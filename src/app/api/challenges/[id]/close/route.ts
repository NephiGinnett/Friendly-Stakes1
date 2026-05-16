import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser, appUrl } from "@/lib/discordNotify";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenge = await prisma.challenge.findUnique({ where: { id: parseInt(params.id) } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (challenge.status !== "active") return NextResponse.json({ error: "Challenge must be active to close" }, { status: 400 });

  const isParticipant = challenge.creatorId === user.id || challenge.acceptedById === user.id;
  if (!isParticipant && !user.isAdmin) return NextResponse.json({ error: "Only participants can close" }, { status: 403 });

  await prisma.challenge.update({ where: { id: challenge.id }, data: { status: "voting" } });

  const msg = `🗳️ **Voting is open** on bounty "${challenge.title}" — did they complete it?\n${appUrl(`/challenges`)}`;
  if (challenge.creatorId !== user.id) void notifyUser(challenge.creatorId, msg);
  if (challenge.acceptedById && challenge.acceptedById !== user.id) void notifyUser(challenge.acceptedById, msg);

  return NextResponse.json({ ok: true });
}
