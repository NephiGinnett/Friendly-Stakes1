import { prisma } from "@/lib/db";
import { HEAL_SOURCE } from "@/lib/houseLog";
import { logPoints } from "@/lib/pointLog";

/** Points a player must lose to restore 1 HP — mirrors the 2 pts = 1 HP attack ratio. */
export const HEAL_RATIO = 2;

/**
 * Feeds a player's net point loss into THE HOUSE's health.
 *
 * Every losing wager at every table routes through here, so the boss grows
 * whenever the group gambles and loses. Overheal is intentional: bossHp is not
 * capped at bossMaxHp, so a losing streak can push The House above 100%
 * integrity and the group has to claw it back down.
 *
 * No-ops unless the boss is live (phase 4, active, not yet dead) — so ordinary
 * Casino Night play outside the boss fight is unaffected.
 *
 * Every heal is attributed to the player who lost the points via a
 * `HouseDamageLog` row with source `heal`, which is what drives the healing
 * leaderboard and the Unwitting Accomplice award.
 *
 * Pass a transaction client when the caller is already inside `$transaction`
 * so the heal commits atomically with the point deduction.
 *
 * @param db     prisma client or transaction client
 * @param userId the player whose loss is feeding The House
 * @param pointsLost  net points the player lost (positive number)
 * @returns HP restored (0 if the boss isn't live or the loss was too small)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function healBossFromLoss(db: any, userId: number, pointsLost: number): Promise<number> {
  if (!Number.isFinite(pointsLost) || pointsLost <= 0) return 0;

  const config = await db.houseConfig.findUnique({ where: { id: 1 } });
  if (!config?.bossActive || config.phase !== 4 || config.bossHp <= 0) return 0;

  const healHp = Math.floor(pointsLost / HEAL_RATIO);
  if (healHp <= 0) return 0;

  // Deliberately uncapped — see note above.
  await db.houseConfig.update({
    where: { id: 1 },
    data: { bossHp: { increment: healHp } },
  });

  // Attribute the heal so the healing board reflects HP actually restored.
  await db.houseDamageLog.create({
    data: { userId, amount: healHp, source: HEAL_SOURCE },
  });

  // Receipt in the player's own point log. Amount 0 — the points were already
  // deducted by the game itself; this records where they went.
  await logPoints(db, userId, 0, `THE HOUSE absorbed your loss — restored ${healHp} HP`);

  return healHp;
}

/** Convenience wrapper for callers outside a transaction. */
export async function healBoss(userId: number, pointsLost: number): Promise<number> {
  return healBossFromLoss(prisma, userId, pointsLost);
}
