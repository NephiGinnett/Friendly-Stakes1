import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const AVID_READER_COST = 45;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.houseConfig.findUnique({ where: { id: 1 }, select: { arFaireActive: true } });
  if (!config?.arFaireActive) return NextResponse.json({ error: "The AR Faire event has ended." }, { status: 403 });

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { bookmarkTokens: true },
  });
  if (!fullUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const alreadyOwned = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId: user.id, achievementId: "avid_reader" } },
  });
  if (alreadyOwned) return NextResponse.json({ error: "You already own the Avid Reader achievement." }, { status: 400 });

  if (fullUser.bookmarkTokens < AVID_READER_COST) {
    return NextResponse.json({ error: `Need ${AVID_READER_COST} Bookmark Tokens (you have ${fullUser.bookmarkTokens})` }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { bookmarkTokens: { decrement: AVID_READER_COST } } });
    await tx.userAchievement.create({
      data: { userId: user.id, achievementId: "avid_reader", claimed: true },
    });
  });

  return NextResponse.json({ ok: true });
}
