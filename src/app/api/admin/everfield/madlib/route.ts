import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, stageId, title, slots, realVersion, isActive } = await req.json();

  if (id) {
    const ml = await prisma.everFieldMadLib.update({
      where: { id },
      data: {
        stageId: stageId ?? null,
        title,
        slots: typeof slots === "string" ? slots : JSON.stringify(slots),
        realVersion: realVersion ?? "",
        isActive: isActive ?? false,
      },
    });
    return NextResponse.json({ ok: true, madLib: ml });
  }

  const ml = await prisma.everFieldMadLib.create({
    data: {
      stageId: stageId ?? null,
      title,
      slots: typeof slots === "string" ? slots : JSON.stringify(slots),
      realVersion: realVersion ?? "",
      isActive: isActive ?? false,
    },
  });
  return NextResponse.json({ ok: true, madLib: ml });
}
