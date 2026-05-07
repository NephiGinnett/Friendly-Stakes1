import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { targetUsername } = await req.json();

    if (!targetUsername) {
      return NextResponse.json({ error: "Target username required" }, { status: 400 });
    }
    if (targetUsername.toLowerCase() === user.username) {
      return NextResponse.json({ error: "You already know your own PIN!" }, { status: 400 });
    }

    // Check user has an xray item with uses left
    const xrayItem = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType: "xray", usesLeft: { gt: 0 } },
    });
    if (!xrayItem) {
      return NextResponse.json({ error: "You don't have X-Ray Vision" }, { status: 403 });
    }

    // Find target
    const target = await prisma.user.findUnique({
      where: { username: targetUsername.toLowerCase() },
    });
    if (!target) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Deduct one use
    await prisma.userItem.update({
      where: { id: xrayItem.id },
      data: { usesLeft: { decrement: 1 } },
    });

    return NextResponse.json({ pin: target.pinPlain });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
