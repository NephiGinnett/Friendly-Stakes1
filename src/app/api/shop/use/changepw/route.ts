import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length !== 8 || !/^[a-zA-Z0-9]+$/.test(newPassword)) {
    return NextResponse.json({ error: "Password must be exactly 8 alphanumeric characters" }, { status: 400 });
  }

  const item = await prisma.userItem.findFirst({
    where: { userId: user.id, itemType: "changepw", usesLeft: { gt: 0 } },
  });
  if (!item) return NextResponse.json({ error: "You don't have a Change Password item" }, { status: 403 });

  const { hash, salt } = hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: newPassword, passwordHash: hash, passwordSalt: salt },
    }),
    prisma.userItem.update({
      where: { id: item.id },
      data: { usesLeft: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
