import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const pending = await prisma.arQuiz.findMany({
    where: { status: "pending" },
    include: {
      sponsor: { select: { id: true, username: true } },
      questions: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(pending);
}
