import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({
    where: { id: 1 }, select: { bracketLockedAt: true },
  });
  if (config?.bracketLockedAt && new Date() >= config.bracketLockedAt) {
    return NextResponse.json({ error: "Bracket is locked" }, { status: 403 });
  }

  const { round, position, teamCode } = await req.json();
  if (!round || position == null || !teamCode) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  await prisma.bracketPick.upsert({
    where: { userId_round_position: { userId: user.id, round, position } },
    create: { userId: user.id, round, position, teamCode, updatedAt: new Date() },
    update: { teamCode, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { round, position } = await req.json();
  await prisma.bracketPick.deleteMany({
    where: { userId: user.id, round, position },
  });
  return NextResponse.json({ ok: true });
}
