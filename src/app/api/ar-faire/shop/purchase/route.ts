import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const AVID_READER_COST = 45;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 }, select: { arFaireActive: true } });
  if (!config?.arFaireActive) return NextResponse.json({ error: "The AR Faire event has ended." }, { status: 403 });

  let txError: "already_owned" | "insufficient_tokens" | null = null;

  await prisma.$transaction(async (tx) => {
    const [existing, fullUser] = await Promise.all([
      tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: user.id, achievementId: "avid_reader" } },
      }),
      tx.user.findUnique({ where: { id: user.id }, select: { bookmarkTokens: true } }),
    ]);

    if (existing) { txError = "already_owned"; return; }
    if (!fullUser || fullUser.bookmarkTokens < AVID_READER_COST) { txError = "insufficient_tokens"; return; }

    await tx.user.update({ where: { id: user.id }, data: { bookmarkTokens: { decrement: AVID_READER_COST } } });
    await tx.userAchievement.create({
      data: { userId: user.id, achievementId: "avid_reader", claimed: true },
    });
  });

  if (txError === "already_owned") return NextResponse.json({ error: "You already own the Avid Reader achievement." }, { status: 400 });
  if (txError === "insufficient_tokens") return NextResponse.json({ error: `Need ${AVID_READER_COST} Bookmark Tokens` }, { status: 400 });

  return NextResponse.json({ ok: true });
}
