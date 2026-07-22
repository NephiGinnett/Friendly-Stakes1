export type ThemeId = "" | "world-cup" | "neon-red" | "midnight-gold" | "casino-night";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  description: string;
  preview: string;
  css: Record<string, string>;
  overlay?: string;
};

export const THEMES: Record<string, ThemeDef> = {
  "world-cup": {
    id: "world-cup",
    name: "World Cup 2026",
    description: "Green pitch & golden accents. The beautiful game.",
    preview: "🏟️",
    css: {
      "--bg-base": "8, 18, 8",
      "--bg-surface": "12, 24, 12",
      "--accent-primary": "34, 197, 94",
      "--accent-primary-rgb": "34, 197, 94",
      "--accent-secondary": "234, 179, 8",
      "--border-subtle": "34, 197, 94, 0.12",
      "--text-muted": "148, 163, 148",
    },
    overlay: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(34,197,94,0.03) 40px, rgba(34,197,94,0.03) 80px)",
  },
  "neon-red": {
    id: "neon-red",
    name: "Neon Red",
    description: "Crimson glow. For when purple isn't aggressive enough.",
    preview: "🔴",
    css: {
      "--bg-base": "18, 8, 8",
      "--bg-surface": "24, 12, 12",
      "--accent-primary": "239, 68, 68",
      "--accent-primary-rgb": "239, 68, 68",
      "--accent-secondary": "251, 146, 60",
      "--border-subtle": "239, 68, 68, 0.12",
      "--text-muted": "163, 148, 148",
    },
  },
  "midnight-gold": {
    id: "midnight-gold",
    name: "Midnight Gold",
    description: "Deep navy with gold trim. Understated wealth.",
    preview: "✨",
    css: {
      "--bg-base": "8, 8, 20",
      "--bg-surface": "12, 12, 28",
      "--accent-primary": "234, 179, 8",
      "--accent-primary-rgb": "234, 179, 8",
      "--accent-secondary": "168, 85, 247",
      "--border-subtle": "234, 179, 8, 0.12",
      "--text-muted": "148, 148, 163",
    },
  },
  "casino-night": {
    id: "casino-night",
    name: "Casino Night — High Roller",
    description: "The House floor. Crimson felt, gold trim, and the quiet hum of the machines. Awarded to the Big Bet VIP; live for all on the casino floor.",
    preview: "🎰",
    css: {
      "--bg-base": "16, 8, 10",
      "--bg-surface": "24, 12, 15",
      "--accent-primary": "220, 38, 38",
      "--accent-primary-rgb": "220, 38, 38",
      "--accent-secondary": "234, 179, 8",
      "--border-subtle": "220, 38, 38, 0.14",
      "--text-muted": "168, 148, 150",
    },
    overlay: "repeating-linear-gradient(135deg, transparent, transparent 38px, rgba(234,179,8,0.03) 38px, rgba(234,179,8,0.03) 76px)",
  },
};

export function getTheme(id: string): ThemeDef | null {
  return THEMES[id] ?? null;
}
