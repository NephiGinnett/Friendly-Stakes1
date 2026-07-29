export const GAME_REGISTRY = {
  "echolocate": {
    id: "echolocate",
    name: "Echolocate",
    description: "You are a bat. Hunt every bug in the dark. Each shriek lights the maze — then silence swallows it again.",
    emoji: "🦇",
    conversionRate: 250,
    dailyCap: 100,
    leaderboardMetric: "score" as const,
    leaderboardLabel: "Best Score",
    leaderboardUnit: " pts",
  },
  "paint-shop": {
    id: "paint-shop",
    name: "Paint Shop",
    description: "Mix custom paint colors to match customer orders. Faster and more accurate = bigger tips!",
    emoji: "🎨",
    conversionRate: 3,
    dailyCap: 100,
    leaderboardMetric: "total" as const,
    leaderboardLabel: "Best Day",
    leaderboardUnit: "$",
  },
  "tap-forge": {
    id: "tap-forge",
    name: "Tap Forge",
    description: "Tap to smith weapons and armor. Upgrade your forge, prestige for multipliers, and climb the leaderboard.",
    emoji: "🔨",
    conversionRate: 10,
    dailyCap: 100,
    leaderboardMetric: "score" as const,
    leaderboardLabel: "Best Level",
    leaderboardUnit: "",
  },
} as const;

export type GameId = keyof typeof GAME_REGISTRY;
export type GameConfig = (typeof GAME_REGISTRY)[GameId];
