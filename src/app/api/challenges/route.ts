import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import { maskChallenge } from "@/lib/vpn";

const CHALLENGE_FEE = 50;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenges = await prisma.challenge.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, username: true } },
      target: { select: { id: true, username: true } },
      acceptedBy: { select: { id: true, username: true } },
      votes: { include: { user: { select: { id: true, username: true } } } },
    },
  });

  return NextResponse.json(challenges.map(c => maskChallenge(c, user.id)));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, description, targetUsername, offer, useVpn } = await req.json();

    if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (!offer || offer < CHALLENGE_FEE) {
      return NextResponse.json({ error: `Minimum offer is ${CHALLENGE_FEE} pts` }, { status: 400 });
    }
    if (user.points < offer) return NextResponse.json({ error: "Not enough points" }, { status: 400 });

    let targetId: number | null = null;
    if (targetUsername && targetUsername !== "open") {
      if (targetUsername.toLowerCase() === user.username) {
        return NextResponse.json({ error: "Can't challenge yourself" }, { status: 400 });
      }
      const target = await prisma.user.findUnique({ where: { username: targetUsername.toLowerCase() } });
      if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 });
      targetId = target.id;
    }

    // VPN activation
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

    // Apply pending Inspiring Friend multiplier if set
    const multiplier = user.challengeMultiplier > 1 ? user.challengeMultiplier : 1;

    const challenge = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { points: { decrement: offer }, challengeMultiplier: 1 },
      });
      await logPoints(tx, user.id, -offer, `Posted bounty: "${title.trim()}"`);
      return tx.challenge.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          creatorId: user.id,
          targetId,
          offer,
          multiplier,
          vpnActive,
          vpnSeed,
        },
        include: {
          creator: { select: { id: true, username: true } },
          target: { select: { id: true, username: true } },
          acceptedBy: { select: { id: true, username: true } },
          votes: true,
        },
      });
    });

    return NextResponse.json(challenge);
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
