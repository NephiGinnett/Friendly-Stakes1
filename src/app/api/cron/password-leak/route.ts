import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshPasswordLeak } from "@/lib/passwordLeak";

// Triggered Monday and Friday at 8AM by external cron
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 } });
  if (config?.passwordLeakEnabled === false) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Password leak is disabled" });
  }

  const chosen = await refreshPasswordLeak();
  return NextResponse.json({ ok: true, leakAchievementId: chosen });
}
