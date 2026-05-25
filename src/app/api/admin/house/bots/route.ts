import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { enabled } = await req.json();
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });

  await prisma.houseConfig.upsert({
    where: { id: 1 },
    create: { id: 1, botsEnabled: enabled },
    update: { botsEnabled: enabled },
  });

  return NextResponse.json({ ok: true, botsEnabled: enabled });
}
