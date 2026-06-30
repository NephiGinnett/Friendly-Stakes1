import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, slug, stageId, order, pagePath, flavorText, hintText, isActive } = await req.json();

  if (id) {
    const clue = await prisma.everFieldClue.update({
      where: { id },
      data: { slug, stageId: stageId ?? null, order: order ?? 0, pagePath, flavorText, hintText: hintText ?? "", isActive: isActive ?? false },
    });
    return NextResponse.json({ ok: true, clue });
  }

  const clue = await prisma.everFieldClue.create({
    data: { slug, stageId: stageId ?? null, order: order ?? 0, pagePath, flavorText, hintText: hintText ?? "", isActive: isActive ?? false },
  });
  return NextResponse.json({ ok: true, clue });
}
