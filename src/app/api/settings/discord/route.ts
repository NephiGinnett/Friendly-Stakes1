import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyDiscord } from "@/lib/discordNotify";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const full = await prisma.user.findUnique({ where: { id: user.id }, select: { discordUserId: true } });
  return NextResponse.json({ discordUserId: full?.discordUserId ?? null });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { discordUserId } = await req.json();

  // Allow clearing
  if (!discordUserId) {
    await prisma.user.update({ where: { id: user.id }, data: { discordUserId: null } });
    return NextResponse.json({ ok: true, discordUserId: null });
  }

  // Basic validation — Discord IDs are 17–19 digit snowflakes
  if (!/^\d{17,19}$/.test(discordUserId.trim())) {
    return NextResponse.json({ error: "That doesn't look like a valid Discord User ID (should be 17–19 digits)." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { discordUserId: discordUserId.trim() } });

  // Send a confirmation DM so the user knows it worked
  await notifyDiscord(
    discordUserId.trim(),
    `✅ **Friendly Stakes** — You're linked! You'll now get DMs here when something happens in the game. Good luck (you'll need it).`
  );

  return NextResponse.json({ ok: true, discordUserId: discordUserId.trim() });
}
