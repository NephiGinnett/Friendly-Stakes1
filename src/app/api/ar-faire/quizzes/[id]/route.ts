import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quiz = await prisma.arQuiz.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      questions: { orderBy: { order: "asc" } },
      sponsor: { select: { id: true, username: true } },
      completions: { where: { userId: user.id } },
      attempts: { where: { userId: user.id }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!quiz || !["approved", "seeded"].includes(quiz.status)) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const completed = quiz.completions.length > 0;
  const tierPoints: Record<string, number> = { uncommon: 50, rare: 250, epic: 500, legendary: 1000 };

  // Strip correct answers from questions (only return them if already completed)
  const questions = quiz.questions.map((q) => ({
    id: q.id,
    order: q.order,
    text: q.text,
    choiceA: q.choiceA,
    choiceB: q.choiceB,
    choiceC: q.choiceC,
    ...(completed ? { correctIndex: q.correctIndex } : {}),
  }));

  return NextResponse.json({
    id: quiz.id,
    title: quiz.title,
    author: quiz.author,
    tier: quiz.tier,
    imageUrl: quiz.imageUrl,
    sponsor: quiz.sponsor,
    pointReward: tierPoints[quiz.tier] ?? 0,
    questions,
    completed,
    attempts: quiz.attempts.length,
    lastAttempt: quiz.attempts[0] ?? null,
  });
}
