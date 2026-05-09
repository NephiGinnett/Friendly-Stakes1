import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SHOP_ITEMS, ItemType, EARLYBIRD_TIERS, EARLYBIRD_TOTAL } from "@/lib/shop";
import { logPoints } from "@/lib/pointLog";

const BINDLE_THRESHOLD = 3; // earlybird claims needed to unlock Bindle

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { itemType } = await req.json();

    if (!SHOP_ITEMS[itemType as ItemType]) {
      return NextResponse.json({ error: "Unknown item" }, { status: 400 });
    }

    // ── Early Adopter ──────────────────────────────────────────────────────
    if (itemType === "earlybird") {
      const result = await prisma.$transaction(async (tx) => {
        // How many total charges have been claimed globally?
        const globalCount = await tx.userItem.count({ where: { itemType: "earlybird" } });

        if (globalCount >= EARLYBIRD_TOTAL) {
          return { error: "All Early Adopter slots are gone!" };
        }

        const tierValue = EARLYBIRD_TIERS[globalCount];

        // Create the earlybird item row (multiple allowed per user)
        await tx.userItem.create({
          data: { userId: user.id, itemType: "earlybird", usesLeft: 1 },
        });

        // Swap user's balance to this tier
        await tx.user.update({ where: { id: user.id }, data: { points: tierValue } });
        await logPoints(tx, user.id, tierValue - user.points, `Early Adopter slot #${globalCount + 1}`);

        // How many earlybird slots has THIS user now claimed?
        const userCount = await tx.userItem.count({
          where: { userId: user.id, itemType: "earlybird" },
        });

        // Auto-unlock Bindle at threshold (only once)
        let bindleUnlocked = false;
        if (userCount >= BINDLE_THRESHOLD) {
          const already = await tx.userAchievement.findUnique({
            where: { userId_achievementId: { userId: user.id, achievementId: "bindle" } },
          });
          if (!already) {
            await tx.userAchievement.create({
              data: { userId: user.id, achievementId: "bindle" },
            });
            bindleUnlocked = true;
          }
        }

        return { ok: true, tierValue, slot: globalCount + 1, userCount, bindleUnlocked };
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }

      return NextResponse.json(result);
    }

    // ── New Bingo Card ─────────────────────────────────────────────────────
    if (itemType === "newbingocard") {
      const item = SHOP_ITEMS["newbingocard"];

      if (user.points < item.price) {
        return NextResponse.json({ error: "Not enough points" }, { status: 400 });
      }

      const items = await prisma.bingoItem.findMany();
      if (items.length < 25) {
        return NextResponse.json(
          { error: "Not enough bingo items exist yet — ask the admin to add more." },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { points: { decrement: item.price } },
        });
        await tx.bingoSquare.deleteMany({ where: { userId: user.id } });
        const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 25);
        await tx.bingoSquare.createMany({
          data: shuffled.map((it, i) => ({
            userId: user.id,
            bingoItemId: it.id,
            position: i,
            claimStatus: "none",
          })),
        });
      });

      return NextResponse.json({ ok: true });
    }

    // ── Standard items ─────────────────────────────────────────────────────
    const item = SHOP_ITEMS[itemType as ItemType];

    if (user.points < item.price) {
      return NextResponse.json({ error: "Not enough points" }, { status: 400 });
    }

    const existing = await prisma.userItem.findFirst({
      where: { userId: user.id, itemType, usesLeft: { gt: 0 } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `You already have ${existing.usesLeft} use(s) of this item left!` },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.userItem.create({ data: { userId: user.id, itemType, usesLeft: item.maxUses } });
      await tx.user.update({ where: { id: user.id }, data: { points: { decrement: item.price } } });
      await logPoints(tx, user.id, -item.price, `Bought: ${item.name}`);
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
