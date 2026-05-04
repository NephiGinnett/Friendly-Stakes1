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
    if (wager.status !== "started") {
      return NextResponse.json({ error: "Only started wagers can be closed early for voting" }, { status: 400 });
    }

    const isParticipant =
      user.id === wager.creatorId ||
      wager.entries.some((e) => e.userId === user.id);

    if (!isParticipant && !user.isAdmin) {
      return NextResponse.json({ error: "Only participants or admins can close early" }, { status: 403 });
    }

    await prisma.wager.update({
      where: { id: wagerId },
      data: { status: "voting" },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
