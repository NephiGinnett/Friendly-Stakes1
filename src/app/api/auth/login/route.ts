import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPin, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, pin } = await req.json();

    if (!username || !pin) {
      return NextResponse.json({ error: "Username and PIN required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (!user || !verifyPin(pin, user.pinHash, user.pinSalt)) {
      return NextResponse.json({ error: "Invalid username or PIN" }, { status: 401 });
    }

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
