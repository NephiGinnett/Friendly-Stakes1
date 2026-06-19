export type ThemeId = "" | "world-cup" | "neon-red" | "midnight-gold";

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
};

export function getTheme(id: string): ThemeDef | null {
  return THEMES[id] ?? null;
}
