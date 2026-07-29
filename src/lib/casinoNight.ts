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
  ["🍀", 10], ["⭐", 8],  ["🔔", 6],  ["💎", 4], ["🎁", 3], ["💰", 2],
];

export const BASIC_PAYOUTS: Record<Symbol, number> = {
  "🍒": 60,  "🍊": 90,  "🍋": 120, "🍇": 150,
  "🍀": 200, "⭐": 280, "🔔": 400, "💎": 900,
};

// Premium payouts are 2× the basic-tier values (jackpot handled separately),
// with 🎁 lines awarding a random power-up item instead of points.
export const PREMIUM_PAYOUTS: Record<Symbol, number> = {
  "🍒": 240, "🍊": 360, "🍋": 480, "🍇": 600,
  "🍀": 840, "⭐": 1200, "🔔": 1800, "💎": 3600, "🎁": 0, "💰": 0,
};

// A line of 3 🎁 on a premium card wins one of these power-ups at random.
export const SCRATCH_ITEM_POOL = ["thumb", "ward", "temp_vpn", "score_sender"] as const;
export const GIFT_SYMBOL = "🎁";

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
    [grid[0][0], grid[0][1], grid[0][2]],
    [grid[1][0], grid[1][1], grid[1][2]],
    [grid[2][0], grid[2][1], grid[2][2]],
    [grid[0][0], grid[1][0], grid[2][0]],
    [grid[0][1], grid[1][1], grid[2][1]],
    [grid[0][2], grid[1][2], grid[2][2]],
    [grid[0][0], grid[1][1], grid[2][2]],
    [grid[0][2], grid[1][1], grid[2][0]],
  ];
}

export function scratchResult(
  tier: ScratchTier,
  jackpotPool: number
): { grid: Symbol[][]; payout: number; isJackpot: boolean; itemsWon: string[] } {
  const payoutMap = tier === "premium" ? PREMIUM_PAYOUTS : BASIC_PAYOUTS;

  if (tier === "premium" && Math.random() < 0.01) {
    const grid: Symbol[][] = [
      [pickSymbol(PREMIUM_POOL), pickSymbol(PREMIUM_POOL), "💰"],
      [pickSymbol(PREMIUM_POOL), "💰", pickSymbol(PREMIUM_POOL)],
      ["💰", pickSymbol(PREMIUM_POOL), pickSymbol(PREMIUM_POOL)],
    ];
    return { grid, payout: jackpotPool, isJackpot: true, itemsWon: [] };
  }

  const grid = generateGrid(tier);
  const lines = getLines(grid);

  let payout = 0;
  const itemsWon: string[] = [];
  for (const line of lines) {
    if (line[0] === line[1] && line[1] === line[2] && line[0] !== "💰") {
      if (line[0] === GIFT_SYMBOL) {
        // A gift line wins a random power-up instead of points.
        itemsWon.push(SCRATCH_ITEM_POOL[Math.floor(Math.random() * SCRATCH_ITEM_POOL.length)]);
      } else {
        payout += payoutMap[line[0]] ?? 0;
      }
    }
  }

  return { grid, payout, isJackpot: false, itemsWon };
}

// ── Roulette ──────────────────────────────────────────────────────────────────

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export type BetType = "number" | "color" | "dozen" | "half" | "even_odd";

export function spinRoulette(): number {
  return Math.floor(Math.random() * 37);
}

export function resolveRoulette(
  result: number,
  betType: BetType,
  betValue: string,
  betAmount: number
): number {
  switch (betType) {
    case "number": {
      const n = parseInt(betValue);
      return result === n ? betAmount * 35 : 0;
    }
    case "color": {
      if (result === 0) return 0;
      const isRed = RED_NUMBERS.has(result);
      return (betValue === "red" ? isRed : !isRed) ? betAmount : 0;
    }
    case "dozen": {
      if (result === 0) return 0;
      const dozen = parseInt(betValue);
      const inDozen =
        dozen === 1 ? result >= 1 && result <= 12 :
        dozen === 2 ? result >= 13 && result <= 24 :
        result >= 25 && result <= 36;
      return inDozen ? betAmount * 2 : 0;
    }
    case "half": {
      if (result === 0) return 0;
      const low = betValue === "low";
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

// ── Big Bet Show ──────────────────────────────────────────────────────────────

export const BASE_MULTIPLIER = 3.0;
export const ALL_IN_MULTIPLIER = 5.0;

// Games a player can choose to play on the live stage for their Big Bet.
export const BIG_BET_GAMES = [
  { id: "roulette", label: "Roulette", emoji: "🎡" },
  { id: "slots", label: "Slots", emoji: "🎰" },
  { id: "blackjack", label: "Blackjack", emoji: "🃏" },
] as const;

export type BigBetGameId = (typeof BIG_BET_GAMES)[number]["id"];
export const BIG_BET_GAME_IDS: string[] = BIG_BET_GAMES.map((g) => g.id);

// ── Slots ─────────────────────────────────────────────────────────────────────

export const SLOT_SYMBOLS = ["👁", "🏚️", "💀", "🔒", "⚡", "💎", "7️⃣"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

const SLOT_WEIGHTS: [SlotSymbol, number][] = [
  ["🔒", 28],
  ["💀", 22],
  ["🏚️", 18],
  ["⚡", 14],
  ["👁", 10],
  ["💎", 5],
  ["7️⃣", 3],
];

export const SLOT_PAYOUTS: Record<SlotSymbol, number> = {
  "🔒": 2,
  "💀": 3,
  "🏚️": 5,
  "⚡": 8,
  "👁": 15,
  "💎": 25,
  "7️⃣": 50,
};

function pickSlotSymbol(): SlotSymbol {
  const total = SLOT_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [sym, weight] of SLOT_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return sym;
  }
  return SLOT_WEIGHTS[SLOT_WEIGHTS.length - 1][0];
}

export type SlotResult = {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  multiplier: number;
  payout: number;
  isTriple: boolean;
  isDouble: boolean;
};

export function spinSlots(betAmount: number): SlotResult {
  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [
    pickSlotSymbol(),
    pickSlotSymbol(),
    pickSlotSymbol(),
  ];

  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const multiplier = SLOT_PAYOUTS[reels[0]];
    return { reels, multiplier, payout: betAmount * multiplier, isTriple: true, isDouble: false };
  }

  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    return { reels, multiplier: 1, payout: betAmount, isTriple: false, isDouble: true };
  }

  return { reels, multiplier: 0, payout: 0, isTriple: false, isDouble: false };
}
