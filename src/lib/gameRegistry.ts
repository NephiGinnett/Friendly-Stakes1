export const GAME_REGISTRY = {
  "learn-to-fly": {
    id: "learn-to-fly",
    name: "Penguin Flyer",
    description: "Launch a penguin as far as possible. Earn coins, buy upgrades, beat your record.",
    emoji: "🐧",
    conversionRate: 4, // platform pts = floor(coinsEarned / 4)
    dailyCap: 50,      // max platform pts per day from this game
    leaderboardMetric: "distance" as const,
    leaderboardLabel: "Best Distance",
    leaderboardUnit: "m",
  },
} as const;

export type GameId = keyof typeof GAME_REGISTRY;
export type GameConfig = (typeof GAME_REGISTRY)[GameId];
