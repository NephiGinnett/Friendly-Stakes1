import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stages = await prisma.everFieldStage.findMany({
    orderBy: { order: "asc" },
    include: {
      responses: {
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const madLibs = await prisma.everFieldMadLib.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const clues = await prisma.everFieldClue.findMany({
    orderBy: { order: "asc" },
    include: {
      discoveries: {
        include: { user: { select: { username: true } } },
        orderBy: { discoveredAt: "asc" },
      },
    },
  });

  const config = await prisma.everFieldConfig.findUnique({ where: { id: 1 } });

  return NextResponse.json({ stages, madLibs, clues, config });
}

// Toggle event active / set current stage
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const config = await prisma.everFieldConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...body },
    update: body,
  });

  return NextResponse.json({ ok: true, config });
}
