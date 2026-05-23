import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { adViewDate: true, adViewCount: true, hasWatchedAd: true },
  });

  const viewsToday = fullUser?.adViewDate === today ? (fullUser?.adViewCount ?? 0) : 0;

  // Prefer ADS_VIDEO_URLS env var (comma-separated URLs) over filesystem scan
  let videos: string[] = [];
  if (process.env.ADS_VIDEO_URLS) {
    videos = process.env.ADS_VIDEO_URLS.split(",").map((u) => u.trim()).filter(Boolean);
  } else {
    const adsDir = path.join(process.cwd(), "public", "ads");
    try {
      videos = fs.readdirSync(adsDir)
        .filter((f) => /\.(mp4|webm|mov)$/i.test(f))
        .map((f) => `/ads/${f}`);
    } catch { /* directory may not have videos yet */ }
  }

  return NextResponse.json({
    viewsToday,
    maxDaily: 3,
    canWatch: viewsToday < 3,
    hasWatchedAd: fullUser?.hasWatchedAd ?? false,
    videos,
  });
}
