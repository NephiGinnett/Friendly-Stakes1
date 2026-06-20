export type DiscoveryPage = {
  slug: string;
  label: string;
  emoji: string;
  section: string;
};

export const ALL_PAGES: DiscoveryPage[] = [
  { slug: "/", label: "Home", emoji: "🏠", section: "App" },
  { slug: "/feed", label: "Feed", emoji: "📋", section: "App" },
  { slug: "/profile", label: "Profile", emoji: "👤", section: "App" },
  { slug: "/shop", label: "Shop", emoji: "🏪", section: "App" },
  { slug: "/house", label: "The House", emoji: "🏚️", section: "The House" },
  { slug: "/house/boss", label: "Boss Battle", emoji: "⚡", section: "The House" },
  { slug: "/world-cup", label: "World Cup", emoji: "🏆", section: "World Cup" },
  { slug: "/world-cup/team", label: "My Team", emoji: "🔮", section: "World Cup" },
  { slug: "/world-cup/standings", label: "Standings", emoji: "📊", section: "World Cup" },
  { slug: "/world-cup/bracket", label: "Bracket", emoji: "🗂️", section: "World Cup" },
  { slug: "/world-cup/confidence", label: "Confidence Wagers", emoji: "🤝", section: "World Cup" },
  { slug: "/world-cup/parlay", label: "Parlay", emoji: "🎰", section: "World Cup" },
  { slug: "/world-cup/proxy", label: "Proxy", emoji: "🔄", section: "World Cup" },
  { slug: "/world-cup/shootout", label: "Penalty Shootout", emoji: "⚽", section: "World Cup" },
  { slug: "/world-cup/reflex", label: "Keeper's Reflex", emoji: "🧤", section: "World Cup" },
  { slug: "/world-cup/fan-competition", label: "Fan Competition", emoji: "🏅", section: "World Cup" },
  { slug: "/world-cup/shop", label: "WC Shop", emoji: "🛒", section: "World Cup" },
  { slug: "/casino-night", label: "Casino Night", emoji: "🎰", section: "Casino Night" },
  { slug: "/casino-night/scratch", label: "Scratch Cards", emoji: "🃏", section: "Casino Night" },
  { slug: "/casino-night/big-bet", label: "Big Bet Show", emoji: "📺", section: "Casino Night" },
  { slug: "/casino-night/roulette", label: "Roulette", emoji: "🎡", section: "Casino Night" },
  { slug: "/casino-night/slots", label: "Slots", emoji: "🎰", section: "Casino Night" },
];

export const VALID_SLUGS = new Set(ALL_PAGES.map((p) => p.slug));

export const CASINO_PAGES = ALL_PAGES.filter((p) => p.section === "Casino Night");

export function groupBySection(pages: DiscoveryPage[]): Record<string, DiscoveryPage[]> {
  const groups: Record<string, DiscoveryPage[]> = {};
  for (const p of pages) {
    if (!groups[p.section]) groups[p.section] = [];
    groups[p.section].push(p);
  }
  return groups;
}
