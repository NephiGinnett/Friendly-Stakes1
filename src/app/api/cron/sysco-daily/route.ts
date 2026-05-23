import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Called daily at 8AM. Grants a ward to every syscoSubscriber who doesn't already have one.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscribers = await prisma.user.findMany({
    where: { syscoSubscriber: true },
    select: { id: true },
  });

  let granted = 0;
  for (const sub of subscribers) {
    const hasWard = await prisma.userItem.findFirst({
      where: { userId: sub.id, itemType: "ward", usesLeft: { gt: 0 } },
    });
    if (!hasWard) {
      await prisma.userItem.create({ data: { userId: sub.id, itemType: "ward", usesLeft: 1 } });
      granted++;
    }
  }

  return NextResponse.json({ ok: true, subscribers: subscribers.length, granted });
}
