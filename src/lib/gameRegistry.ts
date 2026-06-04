export const GAME_REGISTRY = {
  "learn-to-fly": {
    id: "learn-to-fly",
    name: "Penguin Flyer",
    description: "Launch a penguin as far as possible. Earn coins, buy upgrades, beat your record.",
    emoji: "🐧",
    conversionRate: 4,
    dailyCap: 50,
    leaderboardMetric: "distance" as const,
    leaderboardLabel: "Best Distance",
    leaderboardUnit: "m",
  },
  "echolocate": {
    id: "echolocate",
    name: "Echolocate",
    description: "You are a bat. Hunt every bug in the dark. Each shriek lights the maze — then silence swallows it again.",
    emoji: "🦇",
    conversionRate: 250,
    dailyCap: 50,
    leaderboardMetric: "score" as const,
    leaderboardLabel: "Best Score",
    leaderboardUnit: " pts",
  },
} as const;

export type GameId = keyof typeof GAME_REGISTRY;
export type GameConfig = (typeof GAME_REGISTRY)[GameId];
