import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { THEMES } from "@/lib/themes";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { themeId } = await req.json();

  if (themeId !== "" && !THEMES[themeId]) {
    return NextResponse.json({ error: "Unknown theme" }, { status: 400 });
  }

  if (themeId !== "") {
    let owned: string[] = [];
    try { owned = JSON.parse(user.ownedThemes || "[]"); } catch { /* */ }
    if (!owned.includes(themeId)) {
      return NextResponse.json({ error: "You don't own this theme" }, { status: 403 });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { siteTheme: themeId },
  });

  return NextResponse.json({ ok: true, siteTheme: themeId });
}
