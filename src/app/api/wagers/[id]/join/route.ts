import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fireBots, computeLockedPayout } from "@/lib/publicWagerBots";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { side, stake, useVpn } = await req.json();
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
      include: { entries: true, botEntries: true },
    });

    if (!wager) return NextResponse.json({ error: "Wager not found" }, { status: 404 });
    if (wager.status !== "open") return NextResponse.json({ error: "This wager is no longer open to join" }, { status: 400 });
    if (wager.creatorId === user.id) return NextResponse.json({ error: "You created this wager — you're already on the 'for' side" }, { status: 400 });

    const existing = wager.entries.find((e) => e.userId === user.id);
    if (existing) return NextResponse.json({ error: "You've already joined this wager" }, { status: 409 });

    // Activate VPN if requested and not already active
    let vpnUpdates: { vpnActive?: boolean; vpnSeed?: number } = {};
    if (useVpn && !wager.vpnActive) {
      const vpnItem = await prisma.userItem.findFirst({
        where: { userId: user.id, itemType: "temp_vpn", usesLeft: { gt: 0 } },
      });
      if (!vpnItem) return NextResponse.json({ error: "You don't have a Temporary VPN item." }, { status: 400 });
      vpnUpdates = { vpnActive: true, vpnSeed: Math.floor(Math.random() * 1_000_000) };
      await prisma.userItem.update({ where: { id: vpnItem.id }, data: { usesLeft: { decrement: 1 } } });
    }

    // For public wagers: calculate locked payout at current pool snapshot (before new bots)
    let lockedPayout = 0;
    if (wager.isPublic) {
      const allEntries = [...wager.entries, ...wager.botEntries];
      const curForPool = wager.creatorStake + allEntries.filter((e) => e.side === "for").reduce((s, e) => s + e.stake, 0);
      const curAgainstPool = allEntries.filter((e) => e.side === "against").reduce((s, e) => s + e.stake, 0);
      if (side === "for") {
        lockedPayout = computeLockedPayout(stake, curForPool + stake, curAgainstPool);
      } else {
        lockedPayout = computeLockedPayout(stake, curAgainstPool + stake, curForPool);
      }
    }

    await prisma.$transaction([
      prisma.wagerEntry.create({
        data: { wagerId, userId: user.id, side, stake, lockedPayout },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { points: { decrement: stake } },
      }),
      ...(Object.keys(vpnUpdates).length > 0
        ? [prisma.wager.update({ where: { id: wagerId }, data: vpnUpdates })]
        : []),
    ]);

    // Fire bots for public wagers (real player count = creator + entries so far including this one)
    if (wager.isPublic) {
      const realPlayerCount = 1 + wager.entries.length + 1; // creator + prior entries + this new entry
      await fireBots(wagerId, stake, side, realPlayerCount);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
