import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { maskWager } from "@/lib/vpn";
import { fireBots, computeLockedPayout } from "@/lib/publicWagerBots";
import { notifyUser, appUrl } from "@/lib/discordNotify";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (tag === "world-cup") where.wcBet = true;

  const wagers = await prisma.wager.findMany({
    where,
    include: {
      creator: { select: { id: true, username: true } },
      entries: {
        include: { user: { select: { id: true, username: true } } },
      },
      votes: { include: { user: { select: { id: true, username: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(wagers.map(w => maskWager(w, user.id)));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, description, creatorPosition, creatorStake, deadline, useVpn, isPublic, wcBet } = await req.json();

    if (!title || !creatorPosition || !creatorStake || !deadline) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (creatorStake < 1) {
      return NextResponse.json({ error: "Stake must be at least 1 point" }, { status: 400 });
    }
    if (creatorStake > user.points) {
      return NextResponse.json({ error: "Not enough points" }, { status: 400 });
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return NextResponse.json({ error: "Deadline must be in the future" }, { status: 400 });
    }

    let vpnActive = false;
    let vpnSeed = 0;
    if (useVpn) {
      const vpnItem = await prisma.userItem.findFirst({
        where: { userId: user.id, itemType: "temp_vpn", usesLeft: { gt: 0 } },
      });
      if (!vpnItem) return NextResponse.json({ error: "You don't have a Temporary VPN item." }, { status: 400 });
      vpnActive = true;
      vpnSeed = Math.floor(Math.random() * 1_000_000);
      await prisma.userItem.update({ where: { id: vpnItem.id }, data: { usesLeft: { decrement: 1 } } });
    }

    const [wager] = await prisma.$transaction([
      prisma.wager.create({
        data: {
          title,
          description: description || null,
          creatorId: user.id,
          creatorPosition,
          creatorStake,
          deadline: deadlineDate,
          vpnActive,
          vpnSeed,
          isPublic: !!isPublic,
          wcBet: wcBet !== false,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { points: { decrement: creatorStake } },
      }),
    ]);

    // For public wagers: fire bots, then lock in creator's payout
    if (isPublic) {
      await fireBots(wager.id, creatorStake, "for", 1);
      // Calculate creator's locked payout using pool after bots fired
      const botEntries = await prisma.botEntry.findMany({ where: { wagerId: wager.id }, select: { side: true, stake: true } });
      const botFor = botEntries.filter((b) => b.side === "for").reduce((s, b) => s + b.stake, 0);
      const botAgainst = botEntries.filter((b) => b.side === "against").reduce((s, b) => s + b.stake, 0);
      const forPool = creatorStake + botFor;
      const againstPool = botAgainst;
      const lockedPayout = computeLockedPayout(creatorStake, forPool, againstPool);
      await prisma.wager.update({ where: { id: wager.id }, data: { creatorLockedPayout: lockedPayout } });
    }

    // Notify all Discord-linked players about the new wager
    const label = isPublic ? "📈 **New public wager**" : "🎲 **New wager posted**";
    const allPlayers = await prisma.user.findMany({
      where: { isAdmin: false, id: { not: user.id } },
      select: { id: true },
    });
    for (const p of allPlayers) {
      void notifyUser(p.id, `${label} by **${user.username}**\n> "${title}"\n${appUrl("/feed")}`);
    }

    return NextResponse.json(wager, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
