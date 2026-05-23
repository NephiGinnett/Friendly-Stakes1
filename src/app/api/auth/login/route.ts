import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
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
