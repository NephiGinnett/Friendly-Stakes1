import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CASINO_PAGES } from "@/lib/casinoNight";

const VALID_SLUGS = new Set(CASINO_PAGES.map((p) => p.slug));

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visited: string[] = JSON.parse(user.visitedPages || "[]");
  return NextResponse.json({ visited });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await req.json() as { slug: string };
  if (!slug || !VALID_SLUGS.has(slug)) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const visited: string[] = JSON.parse(user.visitedPages || "[]");
  if (!visited.includes(slug)) {
    visited.push(slug);
    await prisma.user.update({
      where: { id: user.id },
      data: { visitedPages: JSON.stringify(visited) },
    });
  }

  return NextResponse.json({ visited });
}
