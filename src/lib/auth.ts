import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE_NAME = "fs_session";

export function hashPin(pin: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(pin, useSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash, salt: useSalt };
}

export function verifyPin(pin: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPin(pin, storedSalt);
  return hash === storedHash;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  return hashPin(password, salt);
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  if (!storedHash || !storedSalt) return false;
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { userId, token },
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Forbidden");
  return user;
}
