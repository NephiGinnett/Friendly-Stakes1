import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const items = await prisma.bingoItem.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const { raw } = await req.json();
    const lines: string[] = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);

    const items: { text: string; providerName: string }[] = [];
    for (const line of lines) {
      const colonIdx = line.lastIndexOf(":");
      if (colonIdx === -1) continue;
      const text = line.slice(0, colonIdx).trim();
      const providerName = line.slice(colonIdx + 1).trim();
      if (text && providerName) items.push({ text, providerName });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "No valid items found. Use format: Item text: PlayerName" }, { status: 400 });
    }

    await prisma.bingoItem.createMany({ data: items });
    return NextResponse.json({ ok: true, added: items.length });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
