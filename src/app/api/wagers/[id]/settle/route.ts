import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { doSettle } from "@/lib/settle";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const { winnerSide } = await req.json();
    const wagerId = parseInt(params.id);

    if (winnerSide !== "for" && winnerSide !== "against") {
      return NextResponse.json({ error: "winnerSide must be 'for' or 'against'" }, { status: 400 });
    }

    const wager = await prisma.wager.findUnique({
      where: { id: wagerId },
      include: { entries: true },
    });
    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status === "settled" || wager.status === "cancelled") {
      return NextResponse.json({ error: "Wager already resolved" }, { status: 400 });
    }

    if (winnerSide === "against") {
      const againstCount = wager.entries.filter((e) => e.side === "against").length;
      if (againstCount === 0) {
        return NextResponse.json({ error: "No one is on the 'against' side" }, { status: 400 });
      }
    }

    await doSettle(wagerId, winnerSide, "admin");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
