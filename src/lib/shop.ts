export const SHOP_ITEMS = {
  xray: {
    id: "xray",
    name: "PIN Crack",
    description: "Crack another player's PIN. One-time use.",
    price: 400,
    maxUses: 1,
    emoji: "💀",
  },
  ward: {
    id: "ward",
    name: "Ward",
    description: "Passively protects your PIN. Each attempt has a 40–75% chance of being blocked.",
    price: 200,
    maxUses: 1,
    emoji: "🛡️",
  },
  thumb: {
    id: "thumb",
    name: "Thumb on the Scale",
    description: "Your vote counts double during resolution. 2 uses.",
    price: 750,
    maxUses: 2,
    emoji: "👍",
  },
  earlybird: {
    id: "earlybird",
    name: "Early Adopter",
    description:
      "Swap your current point balance for a tiered reward — earlier is better. Only 6 slots total, shared across everyone. Free to claim!",
    price: 0,
    maxUses: 1,
    emoji: "⭐",
  },
  newbingocard: {
    id: "newbingocard",
    name: "New Bingo Card",
    description: "Wipe your current bingo card and get a freshly shuffled one. No refunds, no regrets.",
    price: 1500,
    maxUses: 1,
    emoji: "🎱",
  },
  pinreset: {
    id: "pinreset",
    name: "Pin Reset",
    description: "Change your PIN to whatever you want. One-time use.",
    price: 100,
    maxUses: 1,
    emoji: "🔑",
  },
  changepw: {
    id: "changepw",
    name: "Change Password",
    description: "Change your login password to whatever you want. One-time use.",
    price: 350,
    maxUses: 1,
    emoji: "🔐",
  },
  becou: {
    id: "becou",
    name: "Be Cou",
    description: "Earns you the Be Cou tag. St Sins players can donate points to you.",
    price: 100,
    maxUses: 1,
    emoji: "🕊️",
  },
  stsins: {
    id: "stsins",
    name: "St Sins",
    description: "Earns you the St Sins tag. Donate your points to any Be Cou player.",
    price: 450,
    maxUses: 1,
    emoji: "😈",
  },
  temp_vpn: {
    id: "temp_vpn",
    name: "Temporary VPN",
    description: "Anonymizes all participant names and bet amounts in one wager or challenge. Observers see state abbreviation aliases (TX-Gambler, etc.) and ??? for amounts. Activate when posting or accepting.",
    price: 225,
    maxUses: 1,
    emoji: "🕵️",
  },
  history_viewer: {
    id: "history_viewer",
    name: "Point History Viewer",
    description: "Peek at another player's full point history log, the same way they see it themselves. One-time use.",
    price: 500,
    maxUses: 1,
    emoji: "📋",
  },
} as const;

export type ItemType = keyof typeof SHOP_ITEMS;

// Reward per slot (slot 0 = first buyer gets 1500, slot 5 = last gets 500)
export const EARLYBIRD_TIERS = [1500, 1300, 1100, 900, 700, 500];
export const EARLYBIRD_TOTAL = EARLYBIRD_TIERS.length;
