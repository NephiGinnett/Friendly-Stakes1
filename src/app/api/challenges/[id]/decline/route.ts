import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenge = await prisma.challenge.findUnique({ where: { id: parseInt(params.id) } });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (challenge.status !== "pending") return NextResponse.json({ error: "Challenge is not pending" }, { status: 400 });

  const isTarget = challenge.targetId === user.id;
  const isCreator = challenge.creatorId === user.id;

  if (!isTarget && !isCreator && !user.isAdmin) {
    return NextResponse.json({ error: "Not your challenge" }, { status: 403 });
  }

  // Refund full offer to creator
  await prisma.$transaction([
    prisma.user.update({ where: { id: challenge.creatorId }, data: { points: { increment: challenge.offer } } }),
    prisma.challenge.update({ where: { id: challenge.id }, data: { status: "cancelled" } }),
  ]);

  return NextResponse.json({ ok: true });
}
