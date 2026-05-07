import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.userItem.findMany({
    where: { itemType: "becou" },
    include: { user: { select: { id: true, username: true } } },
  });

  const users = items.map((i) => ({ id: i.user.id, username: i.user.username }));
  return NextResponse.json(users);
}
