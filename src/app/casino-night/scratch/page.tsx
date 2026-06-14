"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type ScratchStatus = {
  casinoActive: boolean;
  jackpot: number;
  myPoints: number;
  costs: { basic: number; premium: number };
};

type CardResult = {
  grid: string[][];
  payout: number;
  isJackpot: boolean;
  jackpotAwarded: number;
  newJackpot: number;
  newAchievement: { name: string; emoji: string; reward: string } | null;
};

type ScratchTier = "basic" | "premium";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // cols
  [0, 4, 8], [2, 4, 6],              // diagonals
];

function getWinningCells(flat: string[]): Set<number> {
  const winning = new Set<number>();
  for (const [a, b, c] of WIN_LINES) {
    if (flat[a] === flat[b] && flat[b] === flat[c] && flat[a] !== "💰") {
      winning.add(a); winning.add(b); winning.add(c);
    }
    // jackpot diagonal
    if (flat[a] === "💰" && flat[b] === "💰" && flat[c] === "💰") {
      winning.add(a); winning.add(b); winning.add(c);
    }
  }
  return winning;
}

export default function ScratchPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ScratchStatus | null>(null);
  const [result, setResult] = useState<CardResult | null>(null);
  const [scratched, setScratched] = useState<Set<number>>(new Set());
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [tier, setTier] = useState<ScratchTier>("basic");

  const load = useCallback(() =>
    fetch("/api/casino/scratch")
      .then((r) => r.json())
      .then((d) => setStatus({
        casinoActive: d.casinoActive,
        jackpot: d.jackpot,
        myPoints: d.myPoints,
        costs: d.costs,
      })), []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) router.push("/login"); return r.ok ? r.json() : null; })
      .then((u) => { if (u) load(); });
  }, [router, load]);

  const buy = async () => {
    setBuying(true);
    setError("");
    setResult(null);
    setScratched(new Set());
    const res = await fetch("/api/casino/scratch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const d = await res.json();
    setBuying(false);
    if (res.ok) {
      setResult(d);
      load();
    } else {
      setError(d.error ?? "Something went wrong");
    }
  };

  const scratchCell = (i: number) => {
    if (!result) return;
    setScratched((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  const scratchAll = () => {
    if (!result) return;
    setScratched(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
  };

  if (!status) return null;

  const flat = result ? result.grid.flat() : [];
  const allScratched = scratched.size === 9;
  const winningCells = allScratched ? getWinningCells(flat) : new Set<number>();

  const cost = status.costs[tier];

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/casino-night" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">🃏 Scratch Cards</h1>
          </div>
          <PointsBadge points={status.myPoints} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Jackpot */}
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 text-center">
          <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">Premium Jackpot</p>
          <p className="text-3xl font-black text-white">{formatPoints(status.jackpot)} pts</p>
        </div>

        {/* Tier selector */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Choose Card</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTier("basic")}
              className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                tier === "basic"
                  ? "bg-violet-500/20 border-violet-500/50 text-white"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              <p className="font-bold">Basic</p>
              <p className="text-sm">{formatPoints(status.costs.basic)} pts</p>
              <p className="text-xs text-slate-500 mt-1">Standard prizes</p>
            </button>
            <button
              onClick={() => setTier("premium")}
              className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                tier === "premium"
                  ? "bg-amber-500/20 border-amber-500/50 text-white"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              <p className="font-bold">Premium</p>
              <p className="text-sm">{formatPoints(status.costs.premium)} pts</p>
              <p className="text-xs text-amber-600 mt-1">💰 Jackpot eligible</p>
            </button>
          </div>

          <button
            onClick={buy}
            disabled={buying || status.myPoints < cost || !status.casinoActive}
            className="w-full btn-primary disabled:opacity-40"
          >
            {buying ? "Scratching..." : `Buy ${tier} card — ${formatPoints(cost)} pts`}
          </button>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {!status.casinoActive && <p className="text-xs text-slate-500 text-center">Casino Night is not currently active.</p>}
        </div>

        {/* Scratch card */}
        {result && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                {result.isJackpot ? "💰 JACKPOT!" : result.payout > 0 ? "Winner!" : "Your Card"}
              </p>
              {!allScratched && (
                <button onClick={scratchAll} className="text-xs text-violet-400 hover:text-violet-300">
                  Reveal all
                </button>
              )}
            </div>

            {/* 3×3 grid */}
            <div className="grid grid-cols-3 gap-2">
              {flat.map((sym, i) => (
                <button
                  key={i}
                  onClick={() => scratchCell(i)}
                  className={`aspect-square rounded-xl border text-2xl flex items-center justify-center transition-all ${
                    scratched.has(i)
                      ? winningCells.has(i)
                        ? "bg-amber-500/20 border-amber-500/50"
                        : "bg-white/5 border-white/10"
                      : "bg-slate-700/60 border-slate-600/40 cursor-pointer hover:bg-slate-600/60"
                  }`}
                >
                  {scratched.has(i) ? sym : "?"}
                </button>
              ))}
            </div>

            {allScratched && (
              <div className="text-center space-y-2 pt-1">
                {result.isJackpot ? (
                  <>
                    <p className="text-2xl font-black text-amber-400">💰 JACKPOT!</p>
                    <p className="text-lg text-white font-bold">+{formatPoints(result.jackpotAwarded)} pts</p>
                    <p className="text-xs text-slate-400">The entire accumulated pot. The House is impressed.</p>
                  </>
                ) : result.payout > 0 ? (
                  <>
                    <p className="text-lg font-bold text-emerald-400">+{formatPoints(result.payout)} pts</p>
                  </>
                ) : (
                  <p className="text-slate-500 text-sm">No matching lines. The House thanks you for your contribution.</p>
                )}
                {result.newAchievement && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 mt-2">
                    <p className="text-sm font-bold text-amber-300">
                      {result.newAchievement.emoji} Achievement: {result.newAchievement.name}
                    </p>
                    <p className="text-xs text-slate-400">{result.newAchievement.reward}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payout table */}
        <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Payout Table</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <p className="text-xs text-slate-600 mb-1">Basic</p>
              {[["🍒", 60], ["🍊", 90], ["🍋", 120], ["🍇", 150], ["🍀", 200], ["⭐", 280], ["🔔", 400], ["💎", 900]].map(([s, p]) => (
                <div key={s as string} className="flex justify-between text-slate-400">
                  <span>{s}{s}{s}</span>
                  <span className="font-mono text-xs">{formatPoints(p as number)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Premium</p>
              {[["🍒", 120], ["🍊", 180], ["🍋", 240], ["🍇", 300], ["🍀", 420], ["⭐", 600], ["🔔", 900], ["💎", 1800]].map(([s, p]) => (
                <div key={s as string} className="flex justify-between text-slate-400">
                  <span>{s}{s}{s}</span>
                  <span className="font-mono text-xs">{formatPoints(p as number)}</span>
                </div>
              ))}
              <div className="flex justify-between text-amber-400 font-semibold mt-1">
                <span>💰💰💰</span>
                <span className="font-mono text-xs">JACKPOT</span>
              </div>
            </div>
          </div>
        </div>

      </div>
      <Navbar />
    </div>
  );
}
