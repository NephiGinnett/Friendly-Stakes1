import { createHmac } from "crypto";

export type Zone = "LL" | "LH" | "C" | "CH" | "RL" | "RH";

export const ALL_ZONES: Zone[] = ["LL", "LH", "C", "CH", "RL", "RH"];

// 2×3 goal grid layout — row 0 = high, row 1 = low
export const ZONE_GRID: Zone[][] = [
  ["LH", "CH", "RH"],
  ["LL", "C",  "RL"],
];

// Arrow labels for each zone
export const ZONE_LABELS: Record<Zone, string> = {
  LH: "↖", CH: "↑", RH: "↗",
  LL: "↙",  C: "↓", RL: "↘",
};

// Full names shown in result breakdowns
export const ZONE_NAMES: Record<Zone, string> = {
  LH: "Left High", CH: "Centre High", RH: "Right High",
  LL: "Left Low",   C: "Centre",      RL: "Right Low",
};

const CORNER_ZONES: Zone[] = ["LL", "LH", "RL", "RH"];
const CENTER_ZONES: Zone[] = ["C", "CH"];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(pool: T[], n: number): T[] {
  return Array.from({ length: n }, () => pickRandom(pool));
}

export type BotType = "house" | "shark" | "momentum";

export const BOT_NAMES: Record<BotType, string> = {
  house:    "The House",
  shark:    "The Shark",
  momentum: "The Momentum",
};

export const BOT_ICONS: Record<BotType, string> = {
  house:    "🏦",
  shark:    "🦈",
  momentum: "🌊",
};

// Kicks the bot sends in Keeper's Reflex (you're the keeper saving them)
export function botKicks(type: BotType): Zone[] {
  if (type === "house") {
    // The House never kicks centre — corners only, harder to anticipate
    return pickN(CORNER_ZONES, 5);
  }
  if (type === "shark") {
    // Shark: heavily corner-biased
    const pool: Zone[] = [...CORNER_ZONES, ...CORNER_ZONES, "RL", "LH"];
    return pickN(pool, 5);
  }
  // Momentum: centre-biased
  const pool: Zone[] = [...CENTER_ZONES, ...CENTER_ZONES, ...CENTER_ZONES, ...ALL_ZONES];
  return pickN(pool, 5);
}

// Keeper zones for the Penalty Shootout
// The House "reads" your history and biases toward zones you previously scored on
export function houseKeeperZones(playerLastScoredZones: Zone[]): Zone[] {
  const pool: Zone[] = [...ALL_ZONES];
  if (playerLastScoredZones.length > 0) {
    // Double the weight of zones the player scored on last time
    pool.push(...playerLastScoredZones, ...playerLastScoredZones);
  }
  return pickN(pool, 5);
}

export function cansForScore(score: number): number {
  if (score >= 5) return 3;
  if (score >= 4) return 2;
  if (score >= 3) return 1;
  return 0;
}

const HMAC_SECRET = process.env.SESSION_SECRET ?? "house-reflex-secret-2026";
const REFLEX_EXPIRY_SECONDS = 300; // 5 minutes — covers page load + full game

export function signKicks(userId: number, kicks: Zone[], ts: number): string {
  return createHmac("sha256", HMAC_SECRET)
    .update(`${userId}:${kicks.join(",")}:${ts}`)
    .digest("hex")
    .slice(0, 16);
}

export function verifyKicks(
  userId: number,
  kicks: Zone[],
  ts: number,
  token: string
): boolean {
  if (Date.now() / 1000 - ts > REFLEX_EXPIRY_SECONDS) return false;
  return signKicks(userId, kicks, ts) === token;
}
