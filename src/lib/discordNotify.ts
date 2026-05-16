const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://friendly-stakes.vercel.app");

// Opens a DM channel with a user and sends them a message.
// Silently no-ops if the bot token isn't configured or the user has no Discord ID linked.
export async function notifyDiscord(discordUserId: string, message: string): Promise<void> {
  if (!BOT_TOKEN || !discordUserId) {
    console.error("[Discord] Skipped — BOT_TOKEN present:", !!BOT_TOKEN, "| discordUserId present:", !!discordUserId);
    return;
  }

  try {
    // Step 1: create/fetch DM channel
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });

    if (!dmRes.ok) {
      console.error("[Discord] DM channel error:", dmRes.status, await dmRes.text());
      return;
    }
    const dm = await dmRes.json() as { id: string };

    // Step 2: send message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });
    if (!msgRes.ok) {
      console.error("[Discord] Send message error:", msgRes.status, await msgRes.text());
    }
  } catch (e) {
    console.error("[Discord] Unexpected error:", e);
  }
}

// Convenience: look up a user's discordUserId from DB and notify them.
// Import prisma lazily to avoid circular deps.
export async function notifyUser(userId: number, message: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    const { prisma } = await import("@/lib/db");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordUserId: true } });
    if (user?.discordUserId) await notifyDiscord(user.discordUserId, message);
  } catch {
    // Silent
  }
}

export function appUrl(path: string): string {
  return `${BASE_URL}${path}`;
}
