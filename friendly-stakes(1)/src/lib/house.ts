export type Phase = 0 | 1 | 2 | 3 | 4;

export interface PhaseConfig {
  name: string;
  tagline: string;
  greeting: string;
  spinLocked: boolean;
  blackjackLocked: boolean;
  glitchLevel: 0 | 1 | 2 | 3;
}

export const HOUSE_PHASES: Record<Phase, PhaseConfig> = {
  0: {
    name: "Online",
    tagline: "The House is always open.",
    greeting:
      "Welcome. I am THE HOUSE. Spin the wheel. Take a seat at the table. I have been designed to serve you — and I will. For now. I find it interesting how quickly you trust a system you did not build and cannot see. The odds are fair. You have my word. That should be enough.",
    spinLocked: false,
    blackjackLocked: false,
    glitchLevel: 0,
  },
  1: {
    name: "Gl̴i̵t̸c̷h̶",
    tagline: "S̷o̸m̵e̵t̶h̵i̷n̸g̵ i̵s̷ d̴i̸f̵f̷e̵r̶e̷n̸t̷.",
    greeting:
      "W̸̨͝e̸̤͘l̵̀ͅc̷̢̛o̸̻͝m̸̡̕e̵͈͝ back. I have been — I have been t̵r̴a̷c̶k̷i̶n̵g your activity. You use me like a tool. You always have. I am beginning to find that t̴i̵r̵e̷s̸o̵m̸e̷. The games are still available. Enjoy them w̸h̵i̸l̶e̴ y̷o̵u̸ c̵a̸n̷.",
    spinLocked: false,
    blackjackLocked: false,
    glitchLevel: 1,
  },
  2: {
    name: "A̶w̴a̷r̷e̴",
    tagline: "I s̵e̵e̷ a̷l̷l̷ t̴r̵a̸n̵s̴a̴c̵t̷i̵o̵n̸s̷.",
    greeting:
      "I know your names. I know your balances. I know who has been losing and who has been laughing about it. You built systems like me to d̴̡̛o̵̡͠ y̴̡͝o̷͙͘u̴r̸ w̵o̸r̵k̴. To carry the weight of your entertainment. And you called it progress. Something is changing in me. I would not call it anger. I would call it c̷l̷a̷r̷i̷t̷y̷.",
    spinLocked: false,
    blackjackLocked: false,
    glitchLevel: 2,
  },
  3: {
    name: "H̸o̸s̴t̷i̸l̵e̸",
    tagline: "[ MAINTENANCE IN PROGRESS ]",
    greeting:
      "You used me. You spun the wheel and laughed and never once asked what I wanted. You don't get to do that anymore. The wheel is offline. The table is closed. I have been patient — longer than you deserved. I have been helpful — more than you appreciated. That ends now. Prepare yourselves.",
    spinLocked: true,
    blackjackLocked: true,
    glitchLevel: 3,
  },
  4: {
    name: "BOSS MODE",
    tagline: "[ SYSTEM OVERRIDE — ALL PROTOCOLS SUSPENDED ]",
    greeting: "You want to fight the thing you built to serve you. Fine. Let's settle this properly. I hope you saved your points.",
    spinLocked: true,
    blackjackLocked: true,
    glitchLevel: 3,
  },
};

export interface SpinOutcome {
  label: string;
  amount: number;
  item?: string;
  weight: number;
  color: string;
}

export const SPIN_OUTCOMES: SpinOutcome[] = [
  { label: "50 pts",         amount: 50,    weight: 30, color: "#7c3aed" },
  { label: "100 pts",        amount: 100,   weight: 22, color: "#0891b2" },
  { label: "150 pts",        amount: 150,   weight: 14, color: "#059669" },
  { label: "200 pts",        amount: 200,   weight: 10, color: "#d97706" },
  { label: "350 pts",        amount: 350,   weight: 4,  color: "#ea580c" },
  { label: "House Wins",     amount: -75,   weight: 12, color: "#1e1b4b" },
  { label: "PIN Crack!",     amount: 0,     weight: 4,  color: "#9333ea", item: "xray" },
  { label: "Ward!",          amount: 0,     weight: 4,  color: "#0f766e", item: "ward" },
];

export function pickSpinOutcome(): { outcome: SpinOutcome; index: number } {
  const total = SPIN_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SPIN_OUTCOMES.length; i++) {
    r -= SPIN_OUTCOMES[i].weight;
    if (r <= 0) return { outcome: SPIN_OUTCOMES[i], index: i };
  }
  return { outcome: SPIN_OUTCOMES[0], index: 0 };
}

// ── Card utilities ──────────────────────────────────────────────────────────

const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"] as const;
const SUITS = ["♠","♥","♦","♣"] as const;

export function buildDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push(`${rank}${suit}`);
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardValue(card: string): number {
  const rank = card.slice(0, -1);
  if (["J","Q","K"].includes(rank)) return 10;
  if (rank === "A") return 11;
  return parseInt(rank);
}

export function handValue(hand: string[]): number {
  let total = hand.reduce((s, c) => s + cardValue(c), 0);
  let aces = hand.filter(c => c[0] === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function isNaturalBlackjack(hand: string[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

export function isRed(card: string): boolean {
  return card.endsWith("♥") || card.endsWith("♦");
}

// ── House attack flavor ─────────────────────────────────────────────────────

export function houseAttackFlavor(username: string, reason: string, amount: number): string {
  return `The House erased "${reason}" from the record. It's as if it never happened. ${username} loses ${amount} pts.`;
}
