import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const wagers = await prisma.wager.findMany({
    orderBy: { createdAt: "desc" },
    include: { entries: true },
    take: 50,
  });

  return NextResponse.json(
    wagers.map((w) => ({
      id: w.id,
      title: w.title,
      status: w.status,
      deadline: w.deadline,
      creatorStake: w.creatorStake,
      wcBet: w.wcBet,
      entryCount: w.entries.length + 1, // +1 for creator
      totalPool: w.creatorStake + w.entries.reduce((s, e) => s + e.stake, 0),
    }))
  );
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id, wcBet } = await req.json();
  if (typeof id !== "number" || typeof wcBet !== "boolean") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.wager.update({ where: { id }, data: { wcBet } });
  return NextResponse.json({ ok: true, id, wcBet });
}
