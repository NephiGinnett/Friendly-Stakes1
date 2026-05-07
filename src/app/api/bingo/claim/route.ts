import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { squareId } = await req.json();

    const square = await prisma.bingoSquare.findUnique({
      where: { id: squareId },
    });

    if (!square || square.userId !== user.id) {
      return NextResponse.json({ error: "Square not found" }, { status: 404 });
    }

    if (square.claimStatus !== "none") {
      return NextResponse.json({ error: "Already claimed or pending" }, { status: 409 });
    }

    await prisma.bingoSquare.update({
      where: { id: squareId },
      data: { claimStatus: "pending" },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
