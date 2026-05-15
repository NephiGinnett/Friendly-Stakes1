import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { maskWager } from "@/lib/vpn";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = status ? { status } : {};

  const wagers = await prisma.wager.findMany({
    where,
    include: {
      creator: { select: { id: true, username: true } },
      entries: {
        include: { user: { select: { id: true, username: true } } },
      },
      votes: { select: { userId: true, choice: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(wagers.map(w => maskWager(w, user.id)));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, description, creatorPosition, creatorStake, deadline, useVpn } = await req.json();

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
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { points: { decrement: creatorStake } },
      }),
    ]);

    return NextResponse.json(wager, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
