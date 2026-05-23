import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyDiscord } from "@/lib/discordNotify";

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, username: true, password: true, discordUserId: true, pwAssistHour: true, pwAssistCount: true },
    });

    if (!user) {
      // Don't reveal whether user exists
      return NextResponse.json({ ok: true });
    }

    if (!user.discordUserId) {
      return NextResponse.json({ error: "That player has not set up Discord notifications." }, { status: 400 });
    }

    // Rate limit: 2 per hour
    const nowHour = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
    const count = user.pwAssistHour === nowHour ? user.pwAssistCount : 0;
    if (count >= 2) {
      return NextResponse.json({ error: "Limit reached — try again next hour." }, { status: 429 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { pwAssistHour: nowHour, pwAssistCount: count + 1 },
    });

    await notifyDiscord(
      user.discordUserId,
      `🔐 **Password reminder for ${user.username}**\nYour current password is: \`${user.password}\`\n\nIf you didn't request this, change your password in the Shop.`
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
