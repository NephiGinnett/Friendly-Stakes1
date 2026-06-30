import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.everFieldConfig.findUnique({ where: { id: 1 } });
  if (!config?.active) {
    return NextResponse.json({ active: false });
  }

  const stages = await prisma.everFieldStage.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      title: true,
      storyText: true,
      playerPrompt: true,
      isActive: true,
      ttsAudioUrl: true,
    },
  });

  const currentStage = config.currentStageId
    ? await prisma.everFieldStage.findUnique({ where: { id: config.currentStageId } })
    : null;

  // Has this user responded to the current active stage?
  let myResponse: string | null = null;
  if (currentStage?.isActive) {
    const existing = await prisma.everFieldResponse.findUnique({
      where: { stageId_userId: { stageId: currentStage.id, userId: user.id } },
    });
    myResponse = existing?.response ?? null;
  }

  // Active mad lib
  const madLib = await prisma.everFieldMadLib.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      slots: true,
      stageId: true,
    },
  });

  let myMadLibEntry: string[] | null = null;
  if (madLib) {
    const entry = await prisma.everFieldMadLibEntry.findUnique({
      where: { madLibId_userId: { madLibId: madLib.id, userId: user.id } },
    });
    myMadLibEntry = entry ? JSON.parse(entry.responses) : null;
  }

  // Clues visible to this user
  const clues = await prisma.everFieldClue.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, slug: true, hintText: true, pagePath: true, order: true },
  });

  const discoveredSlugs = await prisma.everFieldDiscovery.findMany({
    where: { userId: user.id, clueId: { in: clues.map((c) => c.id) } },
    select: { clueId: true },
  });
  const discoveredIds = new Set(discoveredSlugs.map((d) => d.clueId));

  return NextResponse.json({
    active: true,
    stages,
    currentStageId: config.currentStageId,
    currentStagePrompt: currentStage?.playerPrompt ?? null,
    myResponse,
    madLib: madLib ? { ...madLib, slots: JSON.parse(madLib.slots) } : null,
    myMadLibEntry,
    clues: clues.map((c) => ({ ...c, discovered: discoveredIds.has(c.id) })),
  });
}
