import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetUsername } = await req.json();
  if (!targetUsername) return NextResponse.json({ error: "targetUsername required" }, { status: 400 });

  const item = await prisma.userItem.findFirst({
    where: { userId: user.id, itemType: "history_viewer", usesLeft: { gt: 0 } },
  });
  if (!item) return NextResponse.json({ error: "You don't have a Point History Viewer item." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { username: targetUsername.toLowerCase() } });
  if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (target.isAdmin) return NextResponse.json({ error: "Can't view admin history" }, { status: 403 });
  if (target.id === user.id) return NextResponse.json({ error: "That's just your own history — check your profile." }, { status: 400 });

  const logs = await prisma.pointLog.findMany({
    where: { userId: target.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  await prisma.userItem.update({ where: { id: item.id }, data: { usesLeft: { decrement: 1 } } });

  return NextResponse.json({ username: target.username, logs });
}
