// Casino Night — shared logic for scratch cards and roulette

// ── Scratch Cards ─────────────────────────────────────────────────────────────

export type ScratchTier = "basic" | "premium";

export const SCRATCH_COSTS: Record<ScratchTier, number> = {
  basic: 150,
  premium: 400,
};

type Symbol = string;

const BASIC_POOL: [Symbol, number][] = [
  ["🍒", 35], ["🍊", 22], ["🍋", 17], ["🍇", 12],
  ["🍀", 7],  ["⭐", 4],  ["🔔", 2],  ["💎", 1],
];

const PREMIUM_POOL: [Symbol, number][] = [
  ["🍒", 25], ["🍊", 18], ["🍋", 15], ["🍇", 12],
  ["🍀", 10], ["⭐", 8],  ["🔔", 6],  ["💎", 4], ["💰", 2],
];

// Payouts for 3-in-a-line match (per winning line)
export const BASIC_PAYOUTS: Record<Symbol, number> = {
  "🍒": 60,  "🍊": 90,  "🍋": 120, "🍇": 150,
  "🍀": 200, "⭐": 280, "🔔": 400, "💎": 900,
};

export const PREMIUM_PAYOUTS: Record<Symbol, number> = {
  "🍒": 120, "🍊": 180, "🍋": 240, "🍇": 300,
  "🍀": 420, "⭐": 600, "🔔": 900, "💎": 1800, "💰": 0, // 💰 = jackpot, handled separately
};

function pickSymbol(pool: [Symbol, number][]): Symbol {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [sym, weight] of pool) {
    roll -= weight;
    if (roll <= 0) return sym;
  }
  return pool[pool.length - 1][0];
}

function generateGrid(tier: ScratchTier): Symbol[][] {
  const pool = tier === "premium" ? PREMIUM_POOL : BASIC_POOL;
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => pickSymbol(pool))
  );
}

function getLines(grid: Symbol[][]): Symbol[][] {
  return [
    // rows
    [grid[0][0], grid[0][1], grid[0][2]],
    [grid[1][0], grid[1][1], grid[1][2]],
    [grid[2][0], grid[2][1], grid[2][2]],
    // cols
    [grid[0][0], grid[1][0], grid[2][0]],
    [grid[0][1], grid[1][1], grid[2][1]],
    [grid[0][2], grid[1][2], grid[2][2]],
    // diagonals
    [grid[0][0], grid[1][1], grid[2][2]],
    [grid[0][2], grid[1][1], grid[2][0]],
  ];
}

export function scratchResult(
  tier: ScratchTier,
  jackpotPool: number
): { grid: Symbol[][]; payout: number; isJackpot: boolean } {
  const payoutMap = tier === "premium" ? PREMIUM_PAYOUTS : BASIC_PAYOUTS;

  // Jackpot check: 1% chance per premium card
  if (tier === "premium" && Math.random() < 0.01) {
    // Force 💰 in the center diagonal for visual effect
    const grid: Symbol[][] = [
      [pickSymbol(PREMIUM_POOL), pickSymbol(PREMIUM_POOL), "💰"],
      [pickSymbol(PREMIUM_POOL), "💰", pickSymbol(PREMIUM_POOL)],
      ["💰", pickSymbol(PREMIUM_POOL), pickSymbol(PREMIUM_POOL)],
    ];
    return { grid, payout: jackpotPool, isJackpot: true };
  }

  const grid = generateGrid(tier);
  const lines = getLines(grid);

  let payout = 0;
  for (const line of lines) {
    if (line[0] === line[1] && line[1] === line[2] && line[0] !== "💰") {
      payout += payoutMap[line[0]] ?? 0;
    }
  }

  return { grid, payout, isJackpot: false };
}

// ── Roulette ──────────────────────────────────────────────────────────────────

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export type BetType = "number" | "color" | "dozen" | "half" | "even_odd";

export function spinRoulette(): number {
  return Math.floor(Math.random() * 37); // 0–36
}

export function resolveRoulette(
  result: number,
  betType: BetType,
  betValue: string,
  betAmount: number
): number {
  // returns total payout (0 = loss); does NOT include betAmount back
  switch (betType) {
    case "number": {
      const n = parseInt(betValue);
      return result === n ? betAmount * 35 : 0;
    }
    case "color": {
      if (result === 0) return 0; // green — house wins
      const isRed = RED_NUMBERS.has(result);
      return (betValue === "red" ? isRed : !isRed) ? betAmount : 0;
    }
    case "dozen": {
      if (result === 0) return 0;
      const dozen = parseInt(betValue); // 1, 2, or 3
      const inDozen =
        dozen === 1 ? result >= 1 && result <= 12 :
        dozen === 2 ? result >= 13 && result <= 24 :
        result >= 25 && result <= 36;
      return inDozen ? betAmount * 2 : 0;
    }
    case "half": {
      if (result === 0) return 0;
      const low = betValue === "low"; // 1–18 or 19–36
      return (low ? result >= 1 && result <= 18 : result >= 19 && result <= 36)
        ? betAmount : 0;
    }
    case "even_odd": {
      if (result === 0) return 0;
      return (betValue === "even" ? result % 2 === 0 : result % 2 !== 0)
        ? betAmount : 0;
    }
    default:
      return 0;
  }
}

export function rouletteColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

