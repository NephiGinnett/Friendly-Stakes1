import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const clue = await prisma.everFieldClue.findUnique({ where: { slug } });
  if (!clue?.isActive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.everFieldDiscovery.findUnique({
    where: { clueId_userId: { clueId: clue.id, userId: user.id } },
  });

  if (!existing) {
    await prisma.everFieldDiscovery.create({
      data: { clueId: clue.id, userId: user.id },
    });
  }

  return NextResponse.json({
    ok: true,
    firstDiscovery: !existing,
    flavorText: clue.flavorText,
  });
}
