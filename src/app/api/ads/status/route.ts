import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [fullUser, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { adViewCount: true, hasWatchedAd: true },
    }),
    prisma.houseConfig.findUnique({ where: { id: 1 }, select: { arFaireActive: true } }),
  ]);

  const eventActive = config?.arFaireActive ?? false;
  const viewsTotal = fullUser?.adViewCount ?? 0;

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
    viewsTotal,
    maxLifetime: 5,
    canWatch: eventActive && viewsTotal < 5,
    hasWatchedAd: fullUser?.hasWatchedAd ?? false,
    eventActive,
    videos,
  });
}
