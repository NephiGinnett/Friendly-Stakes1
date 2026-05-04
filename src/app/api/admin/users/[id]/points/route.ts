import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const { amount } = await req.json(); // positive = add, negative = subtract
    const targetId = parseInt(params.id);

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (target.points + amount < 0) {
      return NextResponse.json({ error: "Would result in negative balance" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { points: { increment: amount } },
    });

    return NextResponse.json({ id: updated.id, username: updated.username, points: updated.points });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
