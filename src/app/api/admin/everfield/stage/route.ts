import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Create or update a stage
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, order, title, storyText, playerPrompt, isActive, isPublished, ttsAudioUrl } = body;

  if (id) {
    const stage = await prisma.everFieldStage.update({
      where: { id },
      data: { order, title, storyText, playerPrompt, isActive, isPublished, ttsAudioUrl },
    });
    return NextResponse.json({ ok: true, stage });
  }

  const stage = await prisma.everFieldStage.create({
    data: { order, title, storyText: storyText ?? "", playerPrompt, isActive: isActive ?? false, isPublished: isPublished ?? false },
  });
  return NextResponse.json({ ok: true, stage });
}
