import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasNewBingo, isBlackout } from "@/lib/bingo";
import { log } from "@/lib/pointLog";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const { squareId, approved } = await req.json();

    const square = await prisma.bingoSquare.findUnique({
      where: { id: squareId },
      include: { bingoItem: true },
    });

    if (!square || square.claimStatus !== "pending") {
      return NextResponse.json({ error: "Square not found or not pending" }, { status: 404 });
    }

    if (!approved) {
      await prisma.bingoSquare.update({
        where: { id: squareId },
        data: { claimStatus: "none" },
      });
      return NextResponse.json({ ok: true });
    }

    // Get the user's currently approved positions before approving this one
    const allSquares = await prisma.bingoSquare.findMany({
      where: { userId: square.userId },
    });
    const prevApproved = allSquares
      .filter((s) => s.claimStatus === "approved")
      .map((s) => s.position);

    // Approve the square
    await prisma.bingoSquare.update({
      where: { id: squareId },
      data: { claimStatus: "approved", claimedAt: new Date() },
    });

    // Award 50 pts to the item provider (case-insensitive match)
    const provider = await prisma.user.findFirst({
      where: { username: square.bingoItem.providerName.toLowerCase() },
    });
    if (provider) {
      await prisma.user.update({ where: { id: provider.id }, data: { points: { increment: 50 } } });
      await log(provider.id, 50, `Bingo square claimed: "${square.bingoItem.text}"`);
    }

    const newApproved = [...prevApproved, square.position];
    const newBingo = hasNewBingo(prevApproved, square.position);
    const newBlackout = isBlackout(newApproved);

    // Award bingo bonus (100 pts) and first-collective-bingo achievement
    if (newBingo) {
      await prisma.user.update({ where: { id: square.userId }, data: { points: { increment: 100 } } });
      await log(square.userId, 100, "Completed a bingo line!");

      const anyBingo = await prisma.userAchievement.findFirst({
        where: { achievementId: "bingo" },
      });
      if (!anyBingo) {
        await prisma.userAchievement.create({
          data: { userId: square.userId, achievementId: "bingo" },
        });
      }
    }

    // Award blackout bonus (350 pts) and first-collective-blackout achievement
    if (newBlackout) {
      await prisma.user.update({ where: { id: square.userId }, data: { points: { increment: 350 } } });
      await log(square.userId, 350, "Bingo blackout — all 25 squares!");

      const anyBlackout = await prisma.userAchievement.findFirst({
        where: { achievementId: "blackout" },
      });
      if (!anyBlackout) {
        await prisma.userAchievement.create({
          data: { userId: square.userId, achievementId: "blackout" },
        });
      }
    }

    return NextResponse.json({ ok: true, newBingo, newBlackout });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
