import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logPoints(db: any, userId: number, amount: number, reason: string) {
  await db.pointLog.create({ data: { userId, amount, reason } });
}

// Convenience for outside transactions
export async function log(userId: number, amount: number, reason: string) {
  await prisma.pointLog.create({ data: { userId, amount, reason } });
}
