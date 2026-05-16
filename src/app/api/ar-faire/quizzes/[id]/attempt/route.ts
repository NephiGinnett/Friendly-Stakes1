import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const TIER_POINTS: Record<string, number> = { uncommon: 50, rare: 250, epic: 500, legendary: 1000 };
const PASS_THRESHOLD = 0.7;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quizId = parseInt(params.id);
  const { answers } = await req.json();

  if (!Array.isArray(answers)) return NextResponse.json({ error: "answers must be an array" }, { status: 400 });

  const quiz = await prisma.arQuiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!quiz || !["approved", "seeded"].includes(quiz.status)) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const alreadyCompleted = await prisma.arQuizCompletion.findUnique({
    where: { userId_quizId: { userId: user.id, quizId } },
  });
  if (alreadyCompleted) return NextResponse.json({ error: "You already completed this quiz." }, { status: 400 });

  const total = quiz.questions.length;
  if (answers.length !== total) return NextResponse.json({ error: `Expected ${total} answers` }, { status: 400 });

  let score = 0;
  for (let i = 0; i < total; i++) {
    if (answers[i] === quiz.questions[i].correctIndex) score++;
  }

  const passed = score / total >= PASS_THRESHOLD;
  const tokensAwarded = score;
  const pointsAwarded = passed ? (TIER_POINTS[quiz.tier] ?? 0) : 0;

  await prisma.$transaction(async (tx) => {
    await tx.arQuizAttempt.create({
      data: {
        userId: user.id, quizId,
        answers: JSON.stringify(answers),
        score, total, passed, tokensAwarded, pointsAwarded,
      },
    });

    if (passed) {
      await tx.arQuizCompletion.create({ data: { userId: user.id, quizId } });
    }

    if (tokensAwarded > 0 || pointsAwarded > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          bookmarkTokens: { increment: tokensAwarded },
          points: { increment: pointsAwarded },
        },
      });
      await tx.pointLog.create({
        data: {
          userId: user.id,
          amount: passed ? pointsAwarded : 0,
          reason: `AR Faire: "${quiz.title}" — ${score}/${total} correct${passed ? ` (+${pointsAwarded} pts)` : ""} (+${tokensAwarded} 🔖)`,
        },
      });
    }
  });

  return NextResponse.json({
    score, total, passed, tokensAwarded, pointsAwarded,
    correctIndices: quiz.questions.map((q) => q.correctIndex),
  });
}
