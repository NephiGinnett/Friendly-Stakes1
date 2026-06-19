"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import type { GameOverPayload } from "./types";

type Upgrade = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  baseCost: number;
  costScale: number;
  effect: "tap" | "auto" | "multi" | "autocombine";
  baseValue: number;
};

const UPGRADES: Upgrade[] = [
  { id: "hammer", name: "Better Hammer", emoji: "🔨", description: "+1 per tap", baseCost: 10, costScale: 1.5, effect: "tap", baseValue: 1 },
  { id: "anvil", name: "Sturdy Anvil", emoji: "🪨", description: "+2 per tap", baseCost: 50, costScale: 1.6, effect: "tap", baseValue: 2 },
  { id: "bellows", name: "Bellows", emoji: "🌬️", description: "+1/sec auto", baseCost: 100, costScale: 1.7, effect: "auto", baseValue: 1 },
  { id: "apprentice", name: "Apprentice", emoji: "👤", description: "+3/sec auto", baseCost: 500, costScale: 1.8, effect: "auto", baseValue: 3 },
  { id: "enchant", name: "Enchantment", emoji: "✨", description: "×2 multiplier", baseCost: 2000, costScale: 2.5, effect: "multi", baseValue: 2 },
  { id: "autocombine", name: "Auto-Combine", emoji: "⚙️", description: "Auto-buys cheapest upgrade", baseCost: 3500, costScale: 3.0, effect: "autocombine", baseValue: 1 },
];

const PRESTIGE_THRESHOLD = 10000;
const ITEMS = ["🗡️", "🛡️", "⚔️", "🪓", "🏹", "🔱", "⛏️", "🪃"];

function getCost(upgrade: Upgrade, level: number): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScale, level));
}

export default function TapForge({ onGameOver }: { onGameOver: (p: GameOverPayload) => void }) {
  const [coins, setCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [prestige, setPrestige] = useState(0);
  const [tapAnim, setTapAnim] = useState(false);
  const [forgedItem, setForgedItem] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const combineRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef = useRef(0);

  const tapPower = useCallback(() => {
    let base = 1;
    let multi = 1 + prestige * 0.5;
    for (const u of UPGRADES) {
      const lvl = levels[u.id] ?? 0;
      if (lvl === 0) continue;
      if (u.effect === "tap") base += u.baseValue * lvl;
      if (u.effect === "multi") multi *= Math.pow(u.baseValue, lvl);
    }
    return Math.floor(base * multi);
  }, [levels, prestige]);

  const autoRate = useCallback(() => {
    let base = 0;
    let multi = 1 + prestige * 0.5;
    for (const u of UPGRADES) {
      const lvl = levels[u.id] ?? 0;
      if (lvl === 0) continue;
      if (u.effect === "auto") base += u.baseValue * lvl;
      if (u.effect === "multi") multi *= Math.pow(u.baseValue, lvl);
    }
    return Math.floor(base * multi);
  }, [levels, prestige]);

  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    const rate = autoRate();
    if (rate > 0) {
      autoRef.current = setInterval(() => {
        if (!gameOver) {
          setCoins(c => c + rate);
          setTotalCoins(t => { totalRef.current = t + rate; return t + rate; });
        }
      }, 1000);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoRate, gameOver]);

  const handleTap = () => {
    if (gameOver) return;
    const power = tapPower();
    setCoins(c => c + power);
    setTotalCoins(t => { totalRef.current = t + power; return t + power; });
    setTapAnim(true);
    if (Math.random() < 0.05) {
      setForgedItem(ITEMS[Math.floor(Math.random() * ITEMS.length)]);
      setTimeout(() => setForgedItem(null), 1500);
    }
    setTimeout(() => setTapAnim(false), 100);
  };

  const buyUpgrade = (u: Upgrade) => {
    const lvl = levels[u.id] ?? 0;
    const cost = getCost(u, lvl);
    if (coins < cost) return;
    setCoins(c => c - cost);
    setLevels(l => ({ ...l, [u.id]: lvl + 1 }));
  };

  const doPrestige = () => {
    if (totalCoins < PRESTIGE_THRESHOLD) return;
    setPrestige(p => p + 1);
    setCoins(0);
    setTotalCoins(0);
    totalRef.current = 0;
    setLevels({});
  };

  const endGame = () => {
    setGameOver(true);
    onGameOver({
      coinsEarned: totalRef.current,
      distance: 0,
      metadata: {
        prestige,
        totalCoins: totalRef.current,
        score: totalRef.current,
      },
    });
  };

  const currentLevel = UPGRADES.reduce((sum, u) => sum + (levels[u.id] ?? 0), 0) + prestige * 10;

  return (
    <div className="space-y-4">
      {/* Forge display */}
      <div className="relative rounded-2xl bg-gradient-to-b from-orange-950/40 to-amber-950/20 border border-amber-500/20 p-6 text-center">
        <div className="text-xs font-mono text-amber-500/60 mb-1">
          Level {currentLevel} {prestige > 0 && `· Prestige ${prestige} (×${(1 + prestige * 0.5).toFixed(1)})`}
        </div>
        <div className="text-3xl font-bold font-mono text-amber-300 mb-3">
          🪙 {coins.toLocaleString()}
        </div>
        <button
          onClick={handleTap}
          className={`w-32 h-32 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 active:scale-95 transition-all shadow-lg shadow-amber-900/50 flex items-center justify-center mx-auto text-5xl select-none ${
            tapAnim ? "scale-90" : ""
          }`}
        >
          🔨
        </button>
        <div className="mt-2 text-xs text-slate-500 font-mono">
          +{tapPower()}/tap · +{autoRate()}/sec
        </div>
        {forgedItem && (
          <div className="absolute top-4 right-4 text-3xl animate-bounce">
            {forgedItem}
          </div>
        )}
      </div>

      {/* Upgrades */}
      <div className="space-y-2">
        {UPGRADES.map(u => {
          const lvl = levels[u.id] ?? 0;
          const cost = getCost(u, lvl);
          const canAfford = coins >= cost;
          return (
            <button
              key={u.id}
              onClick={() => buyUpgrade(u)}
              disabled={!canAfford}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                canAfford
                  ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-white"
                  : "bg-white/5 border-white/10 text-slate-500"
              }`}
            >
              <span className="text-xl">{u.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{u.name} <span className="text-xs text-slate-500">Lv.{lvl}</span></div>
                <div className="text-xs opacity-60">{u.description}</div>
              </div>
              <div className="text-xs font-mono text-amber-400 shrink-0">🪙 {cost.toLocaleString()}</div>
            </button>
          );
        })}
      </div>

      {/* Prestige */}
      {totalCoins >= PRESTIGE_THRESHOLD && (
        <button
          onClick={doPrestige}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors"
        >
          ⭐ Prestige — Reset for ×{(1 + (prestige + 1) * 0.5).toFixed(1)} multiplier
        </button>
      )}

      {/* Cash out */}
      <div className="flex gap-3">
        <button
          onClick={endGame}
          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
        >
          Cash Out — 🪙 {totalCoins.toLocaleString()}
        </button>
      </div>

      <div className="text-center text-xs text-slate-600 font-mono">
        Total forged: 🪙 {totalCoins.toLocaleString()} · 10 coins = 1 pt
      </div>
    </div>
  );
}
