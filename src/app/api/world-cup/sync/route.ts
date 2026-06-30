import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fetchFdMatches, upsertMatches, seedBracketSlots } from "@/lib/wcSync";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let lastSyncAt = 0;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  if (now - lastSyncAt < SYNC_INTERVAL_MS) {
    return NextResponse.json({ ok: true, skipped: true, reason: "recently synced" });
  }

  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no API key" });
  }

  try {
    lastSyncAt = now;
    const matches = await fetchFdMatches(token);
    const { upserted, errors } = await upsertMatches(matches);
    const bracketSlots = await seedBracketSlots(matches);
    return NextResponse.json({ ok: true, upserted, bracketSlots, errors: errors.length });
  } catch {
    return NextResponse.json({ ok: true, skipped: true, reason: "sync failed" });
  }
}
