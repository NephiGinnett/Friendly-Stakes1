import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 });

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { startedAt: true, endedAt: true },
  });
  if (!session || session.endedAt) return NextResponse.json({ ok: false });

  const now = new Date();
  const durationSecs = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { lastPingAt: now, durationSecs },
  });

  return NextResponse.json({ ok: true });
}
