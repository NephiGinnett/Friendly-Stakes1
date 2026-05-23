import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, verifyPin } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pin } = await req.json();
  if (!pin) return NextResponse.json({ valid: false });

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { pinHash: true, pinSalt: true },
  });
  if (!fullUser) return NextResponse.json({ valid: false });

  return NextResponse.json({ valid: verifyPin(pin, fullUser.pinHash, fullUser.pinSalt) });
}
