import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { phase } = await req.json();
  if (typeof phase !== "number" || phase < 0 || phase > 4) {
    return NextResponse.json({ error: "Phase must be 0–4" }, { status: 400 });
  }

  const config = await prisma.houseConfig.upsert({
    where: { id: 1 },
    create: { id: 1, phase },
    update: { phase },
  });

  return NextResponse.json({ ok: true, phase: config.phase });
}
