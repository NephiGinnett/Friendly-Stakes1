import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const wagerId = parseInt(params.id);

    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { entries: true },
    });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "open") return NextResponse.json({ error: "Wager is not in the open lobby" }, { status: 400 });

    const isCreator = user.id === wager.creatorId;
    if (!isCreator && !user.isAdmin) {
      return NextResponse.json({ error: "Only the creator or an admin can start the wager" }, { status: 403 });
    }

    const againstCount = wager.entries.filter((e) => e.side === "against").length;
    if (againstCount === 0) {
      return NextResponse.json(
        { error: "Need at least one person on the 'against' side before starting" },
        { status: 400 }
      );
    }

    await prisma.wager.update({
      where: { id: wagerId },
      data: { status: "started" },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
