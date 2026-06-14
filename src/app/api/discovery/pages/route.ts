import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { VALID_SLUGS, CASINO_PAGES } from "@/lib/discovery";
import { logPoints } from "@/lib/pointLog";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visited: string[] = JSON.parse(user.visitedPages || "[]");
  return NextResponse.json({ visited });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await req.json() as { slug: string };
  if (!slug || !VALID_SLUGS.has(slug)) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const visited: string[] = JSON.parse(user.visitedPages || "[]");
  let newAchievement: string | null = null;

  if (!visited.includes(slug)) {
    visited.push(slug);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { visitedPages: JSON.stringify(visited) },
      });

      // Check casino_explorer: has the player now visited every casino page?
      const casinoSlugs = CASINO_PAGES.map((p) => p.slug);
      const allCasinoVisited = casinoSlugs.every((s) => visited.includes(s));
      if (allCasinoVisited) {
        const existing = await tx.userAchievement.findUnique({
          where: { userId_achievementId: { userId: user.id, achievementId: "casino_explorer" } },
        });
        if (!existing) {
          await tx.userAchievement.create({ data: { userId: user.id, achievementId: "casino_explorer" } });
          await tx.user.update({ where: { id: user.id }, data: { points: { increment: 150 } } });
          await logPoints(tx, user.id, 150, `Achievement unlocked: Full Access`);
          newAchievement = "casino_explorer";
        }
      }
    });
  }

  return NextResponse.json({ visited, newAchievement });
}
