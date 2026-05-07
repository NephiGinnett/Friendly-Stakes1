import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hashPin } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    // ── Snapshot current standings ─────────────────────────────────────────
    const users = await prisma.user.findMany({
      select: { username: true, points: true },
      orderBy: { points: "desc" },
    });

    const timestamp = new Date()
      .toISOString()
      .replace(/T/, "_")
      .replace(/:/g, "-")
      .replace(/\..+/, "");

    const lines = [
      `=== Friendly Stakes — Instance Record ===`,
      `Saved: ${new Date().toUTCString()}`,
      ``,
      ...users.map((u) => `${u.username}: ${u.points} pts`),
    ];

    // Write to /data/records/ (Railway volume) or ./records/ (local dev)
    const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
    const dbPath = dbUrl.replace(/^file:/, "");
    const dbDir = path.dirname(path.resolve(dbPath));
    const recordsDir = path.join(dbDir, "records");

    if (!fs.existsSync(recordsDir)) {
      fs.mkdirSync(recordsDir, { recursive: true });
    }

    const filename = `instance_${timestamp}.txt`;
    fs.writeFileSync(path.join(recordsDir, filename), lines.join("\n"), "utf8");

    // ── Reset the game ──────────────────────────────────────────────────────
    // Delete everything in FK order, including all user accounts.
    // Then immediately recreate the nephi admin so the app stays usable.
    await prisma.$transaction([
      prisma.vote.deleteMany(),
      prisma.wagerEntry.deleteMany(),
      prisma.wager.deleteMany(),
      prisma.bingoSquare.deleteMany(),
      prisma.userItem.deleteMany(),
      prisma.userAchievement.deleteMany(),
      prisma.session.deleteMany(),
      prisma.user.deleteMany(),
    ]);

    // Recreate admin account fresh with PIN 0000
    const { hash, salt } = hashPin("0000");
    await prisma.user.create({
      data: {
        username: "nephi",
        pinHash: hash,
        pinSalt: salt,
        pinPlain: "0000",
        points: 1000,
        isAdmin: true,
      },
    });

    return NextResponse.json({ ok: true, filename, snapshot: lines });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
