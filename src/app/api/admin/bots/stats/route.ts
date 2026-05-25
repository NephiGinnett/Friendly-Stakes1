import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const personalities = await prisma.botPersonality.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(personalities);
}
