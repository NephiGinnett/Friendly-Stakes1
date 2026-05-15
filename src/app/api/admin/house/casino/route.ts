import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { open } = await req.json();
  if (typeof open !== "boolean") return NextResponse.json({ error: "open must be boolean" }, { status: 400 });

  const config = await prisma.houseConfig.upsert({
    where: { id: 1 },
    create: { id: 1, casinoOpen: open },
    update: { casinoOpen: open },
  });

  return NextResponse.json({ casinoOpen: config.casinoOpen });
}
