import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { madLibId, responses } = await req.json();
  if (!madLibId || !Array.isArray(responses)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const madLib = await prisma.everFieldMadLib.findUnique({ where: { id: madLibId } });
  if (!madLib?.isActive) {
    return NextResponse.json({ error: "Mad lib is not currently active." }, { status: 403 });
  }

  const slots: { label: string; type: string }[] = JSON.parse(madLib.slots);
  if (responses.length !== slots.length) {
    return NextResponse.json({ error: "Wrong number of responses." }, { status: 400 });
  }

  const entry = await prisma.everFieldMadLibEntry.upsert({
    where: { madLibId_userId: { madLibId, userId: user.id } },
    create: { madLibId, userId: user.id, responses: JSON.stringify(responses) },
    update: { responses: JSON.stringify(responses) },
  });

  return NextResponse.json({ ok: true, id: entry.id });
}
