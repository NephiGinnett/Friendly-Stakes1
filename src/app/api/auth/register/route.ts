import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPin, hashPassword, createSession, setSessionCookie } from "@/lib/auth";

// ── Edit this list to control who can sign up ──────────────────────────────
const ALLOWED_USERNAMES = [
  "nephi",
  "cj",
  "marcel",
  "vaughn",
  "scott",
  "kyle",
];
// ───────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { username, pin } = await req.json();

    if (!username || !pin) {
      return NextResponse.json({ error: "Username and PIN required" }, { status: 400 });
    }

    const normalised = username.toLowerCase().trim();

    if (!ALLOWED_USERNAMES.includes(normalised)) {
      return NextResponse.json(
        { error: "That username isn't on the guest list! Ask the admin to add you." },
        { status: 403 }
      );
    }

    if (normalised.length < 2 || normalised.length > 20) {
      return NextResponse.json({ error: "Username must be 2-20 characters" }, { status: 400 });
    }

    if (pin.length < 2 || pin.length > 4 || !/^\d+$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 2-4 digits" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username: normalised } });
    if (existing) {
      return NextResponse.json({ error: "That name is already taken — are you already registered?" }, { status: 409 });
    }

    const { hash, salt } = hashPin(pin);
    // Default password = pin repeated twice (e.g. "1234" → "12341234")
    const defaultPassword = (pin + pin).slice(0, 8).padEnd(8, pin);
    const { hash: pwHash, salt: pwSalt } = hashPassword(defaultPassword);
    const user = await prisma.user.create({
      data: {
        username: normalised,
        pinHash: hash,
        pinSalt: salt,
        pinPlain: pin,
        password: defaultPassword,
        passwordHash: pwHash,
        passwordSalt: pwSalt,
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
