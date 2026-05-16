import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

const VALID_TIERS = ["uncommon", "rare", "epic", "legendary"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { action, label, imageUrl, tier } = await req.json();

  if (action === "add") {
    if (!label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });
    if (!VALID_TIERS.includes(tier)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });

    const bookmark = await prisma.arBookmark.create({
      data: { label: label.trim(), imageUrl: imageUrl ?? "", tier },
    });
    return NextResponse.json({ ok: true, id: bookmark.id });
  }

  if (action === "scan") {
    // Scan public/bookmarks/ for files named like "title.tier.png"
    const dir = path.join(process.cwd(), "public", "bookmarks");
    if (!fs.existsSync(dir)) return NextResponse.json({ added: 0, message: "No public/bookmarks/ folder found." });

    const files = fs.readdirSync(dir);
    let added = 0;
    const results: string[] = [];

    for (const file of files) {
      const match = file.match(/^(.+)\.(uncommon|rare|epic|legendary)\.(png|jpg|jpeg|gif|webp)$/i);
      if (!match) continue;
      const [, namePart, tierPart] = match;
      const bookmarkLabel = namePart.replace(/-/g, " ").replace(/_/g, " ");
      const imageUrlPath = `/bookmarks/${file}`;
      const existing = await prisma.arBookmark.findFirst({ where: { imageUrl: imageUrlPath } });
      if (existing) continue;
      await prisma.arBookmark.create({ data: { label: bookmarkLabel, imageUrl: imageUrlPath, tier: tierPart.toLowerCase() } });
      added++;
      results.push(`${bookmarkLabel} (${tierPart})`);
    }

    return NextResponse.json({ added, results });
  }

  return NextResponse.json({ error: "action must be 'add' or 'scan'" }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const bookmarks = await prisma.arBookmark.findMany({ orderBy: [{ tier: "asc" }, { label: "asc" }] });
  return NextResponse.json(bookmarks);
}
