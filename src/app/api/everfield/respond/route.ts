import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stageId, response } = await req.json();
  if (!stageId || !response?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const stage = await prisma.everFieldStage.findUnique({ where: { id: stageId } });
  if (!stage?.isActive) {
    return NextResponse.json({ error: "This stage is not accepting responses." }, { status: 403 });
  }

  const entry = await prisma.everFieldResponse.upsert({
    where: { stageId_userId: { stageId, userId: user.id } },
    create: { stageId, userId: user.id, response: response.trim() },
    update: { response: response.trim() },
  });

  return NextResponse.json({ ok: true, id: entry.id });
}
