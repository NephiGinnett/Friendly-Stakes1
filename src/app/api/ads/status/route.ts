import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

const NORMAL_DAILY = 3;
const EVENT_DAILY = 5;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [fullUser, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { adViewDate: true, adViewCount: true, hasWatchedAd: true },
    }),
    prisma.houseConfig.findUnique({
      where: { id: 1 },
      select: { worldCupPlayerAt: true, worldCupEventEndAt: true },
    }),
  ]);

  const now = new Date();
  const worldCupActive =
    !!config?.worldCupPlayerAt && now >= config.worldCupPlayerAt &&
    (!config.worldCupEventEndAt || now < config.worldCupEventEndAt);
  const maxDaily = worldCupActive ? EVENT_DAILY : NORMAL_DAILY;
  const today = new Date().toISOString().slice(0, 10);
  const viewsToday = fullUser?.adViewDate === today ? (fullUser?.adViewCount ?? 0) : 0;

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
    maxDaily,
    canWatch: viewsToday < maxDaily,
    hasWatchedAd: fullUser?.hasWatchedAd ?? false,
    eventBonus: worldCupActive,
    videos,
  });
}
