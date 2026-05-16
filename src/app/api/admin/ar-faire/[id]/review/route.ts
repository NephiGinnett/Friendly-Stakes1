import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { action } = await req.json(); // "approve" | "reject"
  if (!["approve", "reject"].includes(action)) return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

  const quiz = await prisma.arQuiz.findUnique({
    where: { id: parseInt(params.id) },
    include: { sponsor: true },
  });
  if (!quiz || quiz.status !== "pending") return NextResponse.json({ error: "Quiz not found or not pending" }, { status: 404 });

  if (action === "reject") {
    // Refund sponsor
    await prisma.$transaction(async (tx) => {
      await tx.arQuiz.update({ where: { id: quiz.id }, data: { status: "rejected" } });
      if (quiz.sponsorId) {
        const tierPoints: Record<string, number> = { rare: 250, epic: 500, legendary: 1000 };
        const refund = tierPoints[quiz.tier] ?? 0;
        if (refund > 0) {
          await tx.user.update({ where: { id: quiz.sponsorId }, data: { points: { increment: refund } } });
          await tx.pointLog.create({ data: { userId: quiz.sponsorId, amount: refund, reason: `AR Faire: quiz "${quiz.title}" rejected — refunded` } });
        }
      }
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Approve — create bookmark entry from quiz image
  await prisma.$transaction(async (tx) => {
    await tx.arQuiz.update({ where: { id: quiz.id }, data: { status: "approved" } });
    // Create bookmark linked to this quiz if it has an image
    const existing = await tx.arBookmark.findFirst({ where: { quizId: quiz.id } });
    if (!existing) {
      await tx.arBookmark.create({
        data: {
          label: quiz.title,
          imageUrl: quiz.imageUrl ?? "",
          tier: quiz.tier,
          quizId: quiz.id,
        },
      });
    } else {
      await tx.arBookmark.update({
        where: { id: existing.id },
        data: { imageUrl: quiz.imageUrl ?? existing.imageUrl, tier: quiz.tier },
      });
    }
  });

  return NextResponse.json({ ok: true, status: "approved" });
}
