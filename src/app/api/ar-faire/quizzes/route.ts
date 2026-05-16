import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { seedArFaireQuizzes } from "@/lib/arFaireSeed";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await seedArFaireQuizzes();

  const quizzes = await prisma.arQuiz.findMany({
    where: { status: { in: ["approved", "seeded"] } },
    include: {
      sponsor: { select: { id: true, username: true } },
      _count: { select: { questions: true } },
      completions: { where: { userId: user.id }, select: { id: true } },
      attempts: { where: { userId: user.id }, select: { id: true, passed: true, score: true, total: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(quizzes.map((q) => ({
    id: q.id,
    title: q.title,
    author: q.author,
    tier: q.tier,
    status: q.status,
    imageUrl: q.imageUrl,
    sponsor: q.sponsor,
    questionCount: q._count.questions,
    completed: q.completions.length > 0,
    attempts: q.attempts.length,
    bestScore: q.attempts.length > 0 ? Math.max(...q.attempts.map((a) => a.score)) : null,
  })));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, author, sponsorRate, questions, imageUrl } = await req.json();

  if (!title?.trim() || !author?.trim()) return NextResponse.json({ error: "Title and author required" }, { status: 400 });
  if (![250, 500, 1000].includes(sponsorRate)) return NextResponse.json({ error: "Sponsor rate must be 250, 500, or 1000" }, { status: 400 });
  if (!Array.isArray(questions) || questions.length < 5 || questions.length > 10) {
    return NextResponse.json({ error: "Must include 5–10 questions" }, { status: 400 });
  }
  for (const q of questions) {
    if (!q.text?.trim() || !q.choiceA?.trim() || !q.choiceB?.trim() || !q.choiceC?.trim()) {
      return NextResponse.json({ error: "All questions must have text and 3 choices" }, { status: 400 });
    }
    if (![0, 1, 2].includes(q.correctIndex)) {
      return NextResponse.json({ error: "Each question needs a valid correct answer (0, 1, or 2)" }, { status: 400 });
    }
  }
  if (user.points < sponsorRate) return NextResponse.json({ error: "Not enough points" }, { status: 400 });

  const tierMap: Record<number, string> = { 250: "rare", 500: "epic", 1000: "legendary" };
  const tier = tierMap[sponsorRate];

  const quiz = await prisma.$transaction(async (tx) => {
    const created = await tx.arQuiz.create({
      data: {
        title: title.trim(),
        author: author.trim(),
        tier,
        sponsorId: user.id,
        status: "pending",
        imageUrl: imageUrl || null,
        questions: {
          create: questions.map((q: { text: string; choiceA: string; choiceB: string; choiceC: string; correctIndex: number }, i: number) => ({
            order: i,
            text: q.text.trim(),
            choiceA: q.choiceA.trim(),
            choiceB: q.choiceB.trim(),
            choiceC: q.choiceC.trim(),
            correctIndex: q.correctIndex,
          })),
        },
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { points: { decrement: sponsorRate } } });
    await tx.pointLog.create({ data: { userId: user.id, amount: -sponsorRate, reason: `AR Faire: sponsored quiz "${title.trim()}"` } });
    return created;
  });

  return NextResponse.json({ id: quiz.id }, { status: 201 });
}
