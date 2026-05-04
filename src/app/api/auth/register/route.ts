import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPin, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, pin } = await req.json();

    if (!username || !pin) {
      return NextResponse.json({ error: "Username and PIN required" }, { status: 400 });
    }

    if (username.length < 2 || username.length > 20) {
      return NextResponse.json({ error: "Username must be 2-20 characters" }, { status: 400 });
    }

    if (pin.length < 2 || pin.length > 4 || !/^\d+$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 2-4 digits" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const { hash, salt } = hashPin(pin);
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        pinHash: hash,
        pinSalt: salt,
      },
    });

    const token = await createSession(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      id: user.id,
      username: user.username,
      points: user.points,
      isAdmin: user.isAdmin,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
