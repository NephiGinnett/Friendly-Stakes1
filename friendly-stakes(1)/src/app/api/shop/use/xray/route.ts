import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SHOP_ITEMS } from "@/lib/shop";
import { logPoints } from "@/lib/pointLog";

function randomFakeIp() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(".");
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { targetUsername } = await req.json();

    if (!targetUsername) {
      return NextResponse.json({ error: "Target username required" }, { status: 400 });
    }
    if (targetUsername.toLowerCase() === user.username) {
      return NextResponse.json({ error: "You already know your own PIN!" }, { status: 400 });
    }

    // Check user has a PIN Crack item with uses left
    const xrayItem = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType: "xray", usesLeft: { gt: 0 } },
    });
    if (!xrayItem) {
      return NextResponse.json({ error: "You don't have PIN Crack" }, { status: 403 });
    }

    // Find target
    const target = await prisma.user.findUnique({
      where: { username: targetUsername.toLowerCase() },
    });
    if (!target) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Admins are always protected
    if (target.isAdmin) {
      return NextResponse.json({ error: "That player cannot be cracked." }, { status: 403 });
    }

    // Check if target has an active Ward or Signal Scrambler (permanent ward)
    const ward = await prisma.userItem.findFirst({
      where: { userId: target.id, itemType: { in: ["ward", "signal_scrambler"] }, usesLeft: { gt: 0 } },
    });

    if (ward) {
      // 40–75% chance the ward blocks this attempt
      const blockChance = Math.floor(Math.random() * 36) + 40; // 40..75
      const blocked = Math.random() * 100 < blockChance;

      if (blocked) {
        // Consume the PIN Crack charge; only consume the ward if it's not a permanent scrambler
        const ops = ward.itemType === "signal_scrambler"
          ? [prisma.userItem.update({ where: { id: xrayItem.id }, data: { usesLeft: { decrement: 1 } } })]
          : [
              prisma.userItem.update({ where: { id: ward.id }, data: { usesLeft: { decrement: 1 } } }),
              prisma.userItem.update({ where: { id: xrayItem.id }, data: { usesLeft: { decrement: 1 } } }),
            ];
        await prisma.$transaction(ops);

        // Deduct penalty equal to the xray item cost
        const penalty = SHOP_ITEMS.xray.price;
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: user.id }, data: { points: { decrement: penalty } } });
          await logPoints(tx, user.id, -penalty, `Ward reflection penalty — tried to crack ${target.username}`);
        });

        // Award fuck_you achievement
        const existing = await prisma.userAchievement.findUnique({
          where: { userId_achievementId: { userId: user.id, achievementId: "fuck_you" } },
        });

        if (!existing) {
          const firstEverClaim = await prisma.userAchievement.findFirst({
            where: { achievementId: "fuck_you", frozenData: { not: null } },
          });

          const attemptedAt = new Date().toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit", hour12: true,
          });

          const headersList = await headers();
          const rawIp = headersList.get("x-forwarded-for") || headersList.get("x-real-ip");
          const ip = rawIp ? rawIp.split(",")[0].trim() : randomFakeIp();

          const frozenData =
            firstEverClaim === null
              ? JSON.stringify({
                  username: user.username,
                  victimUsername: target.username,
                  attemptedAt,
                  ip,
                  pin: user.pinPlain,
                })
              : null;

          // Award 250 pts (half of pin reset cost) and unlock achievement
          await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.id }, data: { points: { increment: 250 } } });
            await tx.userAchievement.create({
              data: {
                userId: user.id,
                achievementId: "fuck_you",
                claimed: true,
                frozenData,
              },
            });
          });
        }

        return NextResponse.json({ reflected: true, penalty });
      }
      // Ward failed to block — fall through to normal peek (ward stays intact)
    }

    // Normal peek — deduct one use
    await prisma.userItem.update({
      where: { id: xrayItem.id },
      data: { usesLeft: { decrement: 1 } },
    });

    return NextResponse.json({ pin: target.pinPlain });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
