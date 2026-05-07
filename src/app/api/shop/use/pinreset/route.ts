import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";

function hashPin(pin: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(pin, salt, 10000, 64, "sha512").toString("hex");
  return { hash, salt };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { newPin } = await req.json();

    if (!newPin || !/^\d{2,4}$/.test(newPin)) {
      return NextResponse.json({ error: "PIN must be 2–4 digits" }, { status: 400 });
    }

    const item = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType: "pinreset", usesLeft: { gt: 0 } },
    });

    if (!item) {
      return NextResponse.json({ error: "You don't have a Pin Reset item" }, { status: 400 });
    }

    const { hash, salt } = hashPin(newPin);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { pinHash: hash, pinSalt: salt, pinPlain: newPin },
      }),
      prisma.userItem.update({
        where: { id: item.id },
        data: { usesLeft: { decrement: 1 } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
