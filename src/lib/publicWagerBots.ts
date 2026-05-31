import { prisma } from "@/lib/db";

// ── Helpers ──────────────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function simplifyOdds(forPool: number, againstPool: number): string {
  if (forPool === 0 && againstPool === 0) return "1:1";
  if (againstPool === 0) return `${forPool}:0`;
  if (forPool === 0) return `0:${againstPool}`;
  const g = gcd(forPool, againstPool);
  let a = forPool / g;
  let b = againstPool / g;
  // If either side is still a large number, scale both down and round
  const max = Math.max(a, b);
  if (max > 20) {
    const scale = max / 10;
    a = Math.max(1, Math.round(a / scale));
    b = Math.max(1, Math.round(b / scale));
  }
  return `${a}:${b}`;
}

/** Locked return if this player wins. ownPool includes the player's own stake. */
export function computeLockedPayout(stake: number, ownPool: number, opposingPool: number): number {
  if (opposingPool === 0) return stake; // no opposing pool yet — just get stake back
  return stake + Math.floor((stake / ownPool) * opposingPool);
}

async function getWagerPools(wagerId: number): Promise<{ forPool: number; againstPool: number }> {
  const [wager, entries, bots] = await Promise.all([
    prisma.wager.findUnique({ where: { id: wagerId }, select: { creatorStake: true } }),
    prisma.wagerEntry.findMany({ where: { wagerId }, select: { side: true, stake: true } }),
    prisma.botEntry.findMany({ where: { wagerId }, select: { side: true, stake: true } }),
  ]);
  const all = [...entries, ...bots];
  const forPool = (wager?.creatorStake ?? 0) + all.filter((e) => e.side === "for").reduce((s, e) => s + e.stake, 0);
  const againstPool = all.filter((e) => e.side === "against").reduce((s, e) => s + e.stake, 0);
  return { forPool, againstPool };
}

function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Unnamed bots ─────────────────────────────────────────────────────────────

async function rollUnnamedBots(wagerId: number, maxStake: number, triggeringSide: string) {
  const oppSide = triggeringSide === "for" ? "against" : "for";
  const withCount = rnd(0, 2);
  const againstCount = rnd(0, 1);

  const bots: { wagerId: number; side: string; stake: number; botType: string }[] = [];

  for (let i = 0; i < withCount; i++) {
    bots.push({ wagerId, side: triggeringSide, stake: rnd(1, maxStake), botType: "unnamed" });
  }
  for (let i = 0; i < againstCount; i++) {
    bots.push({ wagerId, side: oppSide, stake: rnd(1, maxStake), botType: "unnamed" });
  }

  if (bots.length > 0) {
    await prisma.botEntry.createMany({ data: bots });
  }

  // Generate display-only "Public Favor" vote counts — large numbers representing
  // the virtual public weighing in. These do not affect the real pool or payouts.
  const forVotes = rnd(0, 2000);
  const againstVotes = rnd(0, 1000);
  await prisma.wager.update({
    where: { id: wagerId },
    data: {
      publicFavorForVotes:     { increment: forVotes },
      publicFavorForPts:       { increment: forVotes > 0 ? rnd(forVotes * 10, forVotes * 50) : 0 },
      publicFavorAgainstVotes: { increment: againstVotes },
      publicFavorAgainstPts:   { increment: againstVotes > 0 ? rnd(againstVotes * 10, againstVotes * 50) : 0 },
    },
  });
}

// ── Opinion bots ─────────────────────────────────────────────────────────────

const SHARK_ID = 1;
const MOMENTUM_ID = 2;
const HOUSE_BOT_ID = 3;

async function getOrCreatePersonality(id: number, name: string) {
  return prisma.botPersonality.upsert({
    where: { id },
    create: { id, name },
    update: {},
  });
}

function botMaxStake(baseMax: number, lossStreak: number): number {
  const multiplier = lossStreak >= 2 ? 0.5 : 1.5;
  return Math.max(1, Math.floor(baseMax * multiplier));
}

/** The Shark: always bets the current favorite (more pool). */
async function rollShark(wagerId: number, maxStake: number) {
  const shark = await getOrCreatePersonality(SHARK_ID, "The Shark");
  const { forPool, againstPool } = await getWagerPools(wagerId);

  // Bet the favorite; if tied, pick randomly
  let side: string;
  if (forPool > againstPool) side = "for";
  else if (againstPool > forPool) side = "against";
  else side = Math.random() < 0.5 ? "for" : "against";

  const cap = botMaxStake(maxStake, shark.lossStreak);
  const stake = rnd(1, cap);
  await prisma.botEntry.create({ data: { wagerId, side, stake, botType: "shark" } });
}

/** The Momentum Player: bets the same side as the triggering real player. */
async function rollMomentum(wagerId: number, maxStake: number, triggeringSide: string) {
  const momentum = await getOrCreatePersonality(MOMENTUM_ID, "The Momentum Player");
  const cap = botMaxStake(maxStake, momentum.lossStreak);
  const stake = rnd(1, cap);
  await prisma.botEntry.create({ data: { wagerId, side: triggeringSide, stake, botType: "momentum" } });
}

// ── The House bot ─────────────────────────────────────────────────────────────

async function rollHouseBot(wagerId: number, maxStake: number) {
  const wager = await prisma.wager.findUnique({
    where: { id: wagerId },
    include: {
      entries: { select: { userId: true, side: true } },
      creator: { select: { id: true } },
    },
  });
  if (!wager) return;

  const house = await getOrCreatePersonality(HOUSE_BOT_ID, "The House");

  // VPN active: The House can't read the players — bets randomly at 1× max stake
  if (wager.vpnActive) {
    const side = Math.random() < 0.5 ? "for" : "against";
    const cap = Math.max(1, maxStake);
    const stake = rnd(1, cap);
    await prisma.botEntry.create({ data: { wagerId, side, stake, botType: "house" } });
    return;
  }

  // Build map of userId → side for this wager
  const playerSides: { userId: number; side: string }[] = [
    { userId: wager.creatorId, side: "for" },
    ...wager.entries.map((e) => ({ userId: e.userId, side: e.side })),
  ];

  // Look up public wager stats for each player
  const users = await prisma.user.findMany({
    where: { id: { in: playerSides.map((p) => p.userId) } },
    select: { id: true, publicWagerWins: true, publicWagerCount: true },
  });

  const statsMap = new Map(users.map((u) => [u.id, u]));

  // Calculate weighted support per side
  // weight = max(publicWagerCount, 2) × win_rate
  let forWeight = 0;
  let againstWeight = 0;

  for (const { userId, side } of playerSides) {
    const stats = statsMap.get(userId);
    const count = stats?.publicWagerCount ?? 0;
    const wins = stats?.publicWagerWins ?? 0;
    const denom = Math.max(count, 2);
    const winRate = wins / denom;
    const weight = denom * winRate;

    if (side === "for") forWeight += weight;
    else againstWeight += weight;
  }

  // Bet the side with higher weighted support; tie → randomly pick
  let side: string;
  if (forWeight > againstWeight) side = "for";
  else if (againstWeight > forWeight) side = "against";
  else side = Math.random() < 0.5 ? "for" : "against";

  const cap = Math.max(1, Math.floor(maxStake * 2));
  const stake = rnd(1, cap);
  await prisma.botEntry.create({ data: { wagerId, side, stake, botType: "house" } });
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Called after each real player bets on a public wager.
 * @param wagerId        The wager
 * @param triggeringStake The real player's stake (used as bot bet ceiling)
 * @param triggeringSide  The real player's side ("for" | "against")
 * @param realPlayerCount Total real players on this wager now (creator = 1)
 */
export async function fireBots(
  wagerId: number,
  triggeringStake: number,
  triggeringSide: string,
  realPlayerCount: number
) {
  const config = await prisma.houseConfig.findUnique({ where: { id: 1 }, select: { botsEnabled: true } });
  if (!config?.botsEnabled) return;

  // Unnamed bots fire for real players 1–3
  if (realPlayerCount <= 3) {
    await rollUnnamedBots(wagerId, triggeringStake, triggeringSide);
  }

  // Opinion bot 1 (The Shark) fires after player 3
  if (realPlayerCount === 3) {
    await rollShark(wagerId, triggeringStake);
  }

  // Opinion bot 2 (The Momentum Player) fires after player 5
  if (realPlayerCount === 5) {
    await rollMomentum(wagerId, triggeringStake, triggeringSide);
  }

  // The House bot fires after player 6
  if (realPlayerCount === 6) {
    await rollHouseBot(wagerId, triggeringStake);
  }
}

// ── Post-settlement: update bot personality records ───────────────────────────

export async function updateBotPersonalityResults(wagerId: number, winnerSide: string) {
  const bots = await prisma.botEntry.findMany({
    where: { wagerId, botType: { in: ["shark", "momentum", "house"] } },
    select: { botType: true, side: true, stake: true },
  });

  const nameMap: Record<string, { id: number; name: string }> = {
    shark:    { id: SHARK_ID,    name: "The Shark" },
    momentum: { id: MOMENTUM_ID, name: "The Momentum Player" },
    house:    { id: HOUSE_BOT_ID, name: "The House" },
  };

  for (const bot of bots) {
    const meta = nameMap[bot.botType];
    if (!meta) continue;
    const won = bot.side === winnerSide;

    if (won) {
      await prisma.botPersonality.upsert({
        where: { id: meta.id },
        create: { id: meta.id, name: meta.name, wins: 1, pointsWon: bot.stake },
        update: { wins: { increment: 1 }, lossStreak: 0, pointsWon: { increment: bot.stake } },
      });
    } else {
      await prisma.botPersonality.upsert({
        where: { id: meta.id },
        create: { id: meta.id, name: meta.name, losses: 1, lossStreak: 1, pointsLost: bot.stake },
        update: { losses: { increment: 1 }, lossStreak: { increment: 1 }, pointsLost: { increment: bot.stake } },
      });
    }
  }
}
