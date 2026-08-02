"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";
import { SLOT_PAYOUTS, SLOT_SYMBOLS, SlotSymbol } from "@/lib/casinoNight";

type SpinResult = {
  reels: [string, string, string];
  multiplier: number;
  payout: number;
  net: number;
  isTriple: boolean;
  isDouble: boolean;
  isAllIn: boolean;
  newAchievement: { name: string; emoji: string; reward: string } | null;
  /** HP your loss restored to THE HOUSE, if a boss fight is live. */
  bossHealed: number;
};

const HOUSE_LINES = [
  "The reels turn. I decide when they stop.",
  "Every pull is a transaction. Every transaction is data.",
  "You think the symbols are random. I think you haven't been paying attention.",
  "Pull again. I'm still learning your patterns.",
];

export default function SlotsPage() {
  const router = useRouter();
  const [myPoints, setMyPoints] = useState(0);
  const [casinoOpen, setCasinoOpen] = useState(false);
  const [betAmount, setBetAmount] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState("");
  const [animReels, setAnimReels] = useState<[string, string, string] | null>(null);
  const [houseLine] = useState(() => HOUSE_LINES[Math.floor(Math.random() * HOUSE_LINES.length)]);
  const spinCount = useRef(0);

  const load = useCallback(() =>
    fetch("/api/casino/slots")
      .then((r) => r.json())
      .then((d) => { setCasinoOpen(d.casinoOpen || d.casinoActive); setMyPoints(d.myPoints); }), []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) router.push("/login"); return r.ok ? r.json() : null; })
      .then((u) => { if (u) load(); });
  }, [router, load]);

  const spin = async () => {
    const amt = parseInt(betAmount);
    if (!amt || amt < 10) { setError("Minimum bet is 10 pts"); return; }
    if (amt > myPoints) { setError("Not enough points"); return; }
    setSpinning(true); setError(""); setResult(null); setAnimReels(null);
    spinCount.current++;

    const res = await fetch("/api/casino/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betAmount: amt }),
    });
    const d = await res.json();
    if (res.ok) {
      let ticks = 0;
      const interval = setInterval(() => {
        const randomReel = (): string => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        setAnimReels([
          ticks >= 8 ? d.reels[0] : randomReel(),
          ticks >= 10 ? d.reels[1] : randomReel(),
          ticks >= 12 ? d.reels[2] : randomReel(),
        ] as [string, string, string]);
        ticks++;
        if (ticks >= 14) {
          clearInterval(interval);
          setAnimReels(d.reels);
          setResult(d);
          setSpinning(false);
          load();
        }
      }, 80);
    } else {
      setError(d.error ?? "Something went wrong");
      setSpinning(false);
    }
  };

  const displayReels = animReels ?? result?.reels;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/casino-night" className="text-slate-400 hover:text-white text-sm">&larr;</Link>
            <h1 className="text-lg font-bold text-white">🎰 Slots</h1>
          </div>
          <PointsBadge points={myPoints} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* House flavor */}
        <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/20 px-5 py-3">
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-1">THE HOUSE</p>
          <p className="text-sm text-emerald-200 italic">&ldquo;{houseLine}&rdquo;</p>
        </div>

        {/* Reels display */}
        <div className={`rounded-2xl border p-6 transition-colors ${
          result?.isTriple ? "bg-amber-500/15 border-amber-500/40" :
          result?.isDouble ? "bg-violet-500/10 border-violet-500/30" :
          result && !result.isTriple && !result.isDouble ? "bg-rose-500/10 border-rose-500/30" :
          "bg-white/5 border-white/10"
        }`}>
          <div className="flex items-center justify-center gap-3">
            {displayReels ? displayReels.map((sym, i) => (
              <div key={i} className={`w-20 h-20 rounded-xl border-2 flex items-center justify-center text-4xl transition-all ${
                result?.isTriple ? "border-amber-500/60 bg-amber-500/10" :
                result?.isDouble && displayReels.filter(s => s === sym).length >= 2 ? "border-violet-500/60 bg-violet-500/10" :
                "border-white/10 bg-white/5"
              } ${spinning ? "animate-pulse" : ""}`}>
                {sym}
              </div>
            )) : (
              [0, 1, 2].map((i) => (
                <div key={i} className="w-20 h-20 rounded-xl border-2 border-white/10 bg-white/5 flex items-center justify-center text-4xl text-slate-700">
                  ?
                </div>
              ))
            )}
          </div>

          {/* Result message */}
          {result && !spinning && (
            <div className="mt-4 text-center">
              {result.isTriple ? (
                <>
                  <p className="text-xl font-black text-amber-400">TRIPLE {result.reels[0]} — x{result.multiplier}!</p>
                  <p className="text-lg font-bold text-white">+{formatPoints(result.net)} pts</p>
                </>
              ) : result.isDouble ? (
                <>
                  <p className="text-sm font-semibold text-violet-400">Double — bet returned</p>
                  <p className="text-xs text-slate-500">The House lets you walk. This time.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-rose-400">-{formatPoints(Math.abs(result.net))} pts</p>
                  <p className="text-xs text-slate-500">The House always collects.</p>
                </>
              )}
              {result.bossHealed > 0 && (
                <p className="mt-2 text-xs font-mono text-emerald-400">
                  🩸 THE HOUSE absorbed your loss — +{result.bossHealed} HP
                </p>
              )}
              {result.newAchievement && (
                <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-2">
                  <p className="text-sm font-bold text-amber-300">{result.newAchievement.emoji} {result.newAchievement.name}</p>
                  <p className="text-xs text-slate-400">{result.newAchievement.reward}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bet controls */}
        {!casinoOpen ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-center">
            <p className="text-slate-400 text-sm">The casino is closed.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Wager</p>
              <div className="flex gap-2">
                <input type="number" min="10" max={myPoints} value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)} placeholder="Min 10 pts..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50" />
                <button onClick={() => setBetAmount(String(myPoints))}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-400 text-sm hover:bg-rose-500/20 transition-colors">
                  All In
                </button>
              </div>
            </div>

            <button onClick={spin} disabled={spinning || !parseInt(betAmount)}
              className="w-full btn-primary disabled:opacity-40 py-3 text-base">
              {spinning ? "Spinning..." : "🎰 PULL"}
            </button>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        )}

        {/* Payout table */}
        <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Payouts</p>
          <div className="space-y-1">
            {(Object.entries(SLOT_PAYOUTS) as [SlotSymbol, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([sym, mult]) => (
                <div key={sym} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{sym}{sym}{sym}</span>
                  <span className={`font-mono text-xs ${mult >= 25 ? "text-amber-400 font-bold" : mult >= 8 ? "text-violet-400" : "text-slate-500"}`}>
                    x{mult}
                  </span>
                </div>
              ))}
            <div className="flex items-center justify-between text-sm border-t border-white/5 pt-1 mt-1">
              <span className="text-slate-600">Any double</span>
              <span className="font-mono text-xs text-slate-600">bet returned</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-700 mt-2">Go all-in for the All Your Chips achievement.</p>
        </div>
      </div>
      <Navbar />
    </div>
  );
}
