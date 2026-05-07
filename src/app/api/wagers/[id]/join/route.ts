import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { side, stake } = await req.json();
    const wagerId = parseInt(params.id);

    if (side !== "for" && side !== "against") {
      return NextResponse.json({ error: "Side must be 'for' or 'against'" }, { status: 400 });
    }
    if (!stake || stake < 1) {
      return NextResponse.json({ error: "Stake must be at least 1 point" }, { status: 400 });
    }
    if (stake > user.points) {
      return NextResponse.json({ error: "Not enough points" }, { status: 400 });
    }

    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { entries: true },
    });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "open") return NextResponse.json({ error: "This wager is no longer open to join" }, { status: 400 });
    if (wager.creatorId === user.id) return NextResponse.json({ error: "You created this wager — you're already on the 'for' side" }, { status: 400 });

    const existing = wager.entries.find((e) => e.userId === user.id);
    if (existing) return NextResponse.json({ error: "You've already joined this wager" }, { status: 409 });

    await prisma.$transaction([
      prisma.wagerEntry.create({
        data: { wagerId, userId: user.id, side, stake },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { points: { decrement: stake } },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
