"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

type BetType = "number" | "color" | "dozen" | "half" | "even_odd";

type SpinResult = {
  result: number;
  betAmount: number;
  winAmount: number;
  net: number;
  isAllIn: boolean;
  newAchievement: { name: string; emoji: string; reward: string } | null;
  /** HP your loss restored to THE HOUSE, if a boss fight is live. */
  bossHealed: number;
};

function numColor(n: number) {
  if (n === 0) return "text-emerald-400";
  return RED_NUMBERS.has(n) ? "text-red-400" : "text-white";
}

function numBg(n: number) {
  if (n === 0) return "bg-emerald-600";
  return RED_NUMBERS.has(n) ? "bg-red-600" : "bg-neutral-800";
}

export default function RoulettePage() {
  const router = useRouter();
  const [myPoints, setMyPoints] = useState(0);
  const [casinoActive, setCasinoActive] = useState(false);
  const [betType, setBetType] = useState<BetType>("color");
  const [betValue, setBetValue] = useState("red");
  const [betAmount, setBetAmount] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState("");
  const [animResult, setAnimResult] = useState<number | null>(null);

  const load = useCallback(() =>
    fetch("/api/casino/roulette")
      .then((r) => r.json())
      .then((d) => { setCasinoActive(d.casinoActive); setMyPoints(d.myPoints); }), []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) router.push("/login"); return r.ok ? r.json() : null; })
      .then((u) => { if (u) load(); });
  }, [router, load]);

  const spin = async () => {
    const amt = parseInt(betAmount);
    if (!amt || amt < 10) { setError("Minimum bet is 10 pts"); return; }
    if (amt > myPoints) { setError("Not enough points"); return; }
    setSpinning(true); setError(""); setSpinResult(null); setAnimResult(null);

    const res = await fetch("/api/casino/roulette", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betAmount: amt, betType, betValue }),
    });
    const d = await res.json();
    if (res.ok) {
      let ticks = 0;
      const interval = setInterval(() => {
        setAnimResult(Math.floor(Math.random() * 37));
        ticks++;
        if (ticks >= 12) {
          clearInterval(interval);
          setAnimResult(d.result);
          setSpinResult(d);
          setSpinning(false);
          load();
        }
      }, 100);
    } else {
      setError(d.error ?? "Something went wrong");
      setSpinning(false);
    }
  };

  const allIn = () => setBetAmount(String(myPoints));

  const betTypeOptions: { value: BetType; label: string }[] = [
    { value: "color", label: "Red / Black" },
    { value: "even_odd", label: "Even / Odd" },
    { value: "half", label: "Low / High" },
    { value: "dozen", label: "Dozen" },
    { value: "number", label: "Straight Number" },
  ];

  const betValueOptions: Record<BetType, { value: string; label: string }[]> = {
    color: [{ value: "red", label: "Red" }, { value: "black", label: "Black" }],
    even_odd: [{ value: "even", label: "Even" }, { value: "odd", label: "Odd" }],
    half: [{ value: "low", label: "Low (1-18)" }, { value: "high", label: "High (19-36)" }],
    dozen: [
      { value: "1", label: "1st (1-12)" },
      { value: "2", label: "2nd (13-24)" },
      { value: "3", label: "3rd (25-36)" },
    ],
    number: Array.from({ length: 37 }, (_, i) => ({ value: String(i), label: String(i) })),
  };

  const payoutMultipliers: Record<BetType, string> = {
    color: "1:1", even_odd: "1:1", half: "1:1", dozen: "2:1", number: "35:1",
  };

  const handleBetTypeChange = (t: BetType) => {
    setBetType(t);
    setBetValue(betValueOptions[t][0].value);
  };

  const displayNum = animResult ?? spinResult?.result;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/casino-night" className="text-slate-400 hover:text-white text-sm">&larr;</Link>
            <h1 className="text-lg font-bold text-white">🎡 Roulette</h1>
          </div>
          <PointsBadge points={myPoints} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        <div className={`rounded-2xl border p-6 text-center space-y-2 transition-colors ${
          displayNum === undefined ? "bg-white/5 border-white/10" :
          displayNum === 0 ? "bg-emerald-600/20 border-emerald-500/40" :
          RED_NUMBERS.has(displayNum) ? "bg-red-600/20 border-red-500/40" :
          "bg-neutral-800/40 border-white/10"
        }`}>
          {displayNum !== undefined ? (
            <>
              <div className={`text-6xl font-black ${numColor(displayNum)}`}>{displayNum}</div>
              <p className={`text-sm font-semibold ${
                displayNum === 0 ? "text-emerald-400" :
                RED_NUMBERS.has(displayNum) ? "text-red-400" : "text-slate-400"
              }`}>
                {displayNum === 0 ? "Green" : RED_NUMBERS.has(displayNum) ? "Red" : "Black"}
                {displayNum !== 0 && ` · ${displayNum % 2 === 0 ? "Even" : "Odd"}`}
                {displayNum !== 0 && ` · ${displayNum <= 18 ? "Low" : "High"}`}
              </p>
            </>
          ) : (
            <p className="text-slate-600 text-4xl py-4">🎡</p>
          )}
        </div>

        {spinResult && !spinning && (
          <div className={`rounded-2xl border px-4 py-3 text-center ${
            spinResult.net > 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
          }`}>
            {spinResult.net > 0 ? (
              <>
                <p className="text-lg font-black text-emerald-400">+{formatPoints(spinResult.net)} pts</p>
                <p className="text-xs text-slate-400">{formatPoints(spinResult.winAmount + spinResult.betAmount)} pts total returned</p>
              </>
            ) : (
              <>
                <p className="text-lg font-black text-rose-400">-{formatPoints(spinResult.betAmount)} pts</p>
                <p className="text-xs text-slate-400">The House appreciated that.</p>
              </>
            )}
            {spinResult.bossHealed > 0 && (
              <p className="mt-2 text-xs font-mono text-emerald-400">
                🩸 THE HOUSE absorbed your loss — +{spinResult.bossHealed} HP
              </p>
            )}
            {spinResult.newAchievement && (
              <div className="mt-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-2">
                <p className="text-sm font-bold text-amber-300">{spinResult.newAchievement.emoji} {spinResult.newAchievement.name}</p>
                <p className="text-xs text-slate-400">{spinResult.newAchievement.reward}</p>
              </div>
            )}
          </div>
        )}

        {!casinoActive ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-center">
            <p className="text-slate-400 text-sm">Casino Night is not currently active.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Bet Type</p>
              <div className="flex flex-wrap gap-2">
                {betTypeOptions.map((o) => (
                  <button key={o.value} onClick={() => handleBetTypeChange(o.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      betType === o.value ? "bg-violet-500/20 border-violet-500/50 text-white" : "bg-white/5 border-white/10 text-slate-400"
                    }`}>
                    {o.label}
                    <span className="ml-1 text-xs text-slate-600">{payoutMultipliers[o.value]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Pick</p>
              {betType === "number" ? (
                <div className="grid grid-cols-7 gap-1">
                  {betValueOptions.number.map((o) => (
                    <button key={o.value} onClick={() => setBetValue(o.value)}
                      className={`rounded text-xs py-1 font-mono font-bold transition-colors ${
                        betValue === o.value ? "ring-2 ring-violet-500" : ""
                      } ${numBg(parseInt(o.value))} ${numColor(parseInt(o.value))}`}>
                      {o.value}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {betValueOptions[betType].map((o) => (
                    <button key={o.value} onClick={() => setBetValue(o.value)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        betValue === o.value ? "bg-violet-500/20 border-violet-500/50 text-white" : "bg-white/5 border-white/10 text-slate-400"
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Amount</p>
              <div className="flex gap-2">
                <input type="number" min="10" max={myPoints} value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)} placeholder="Min 10 pts..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50" />
                <button onClick={allIn}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-400 text-sm hover:bg-rose-500/20 transition-colors">
                  All In
                </button>
              </div>
              {parseInt(betAmount) > 0 && (
                <p className="text-xs text-slate-400">
                  Potential win: +{formatPoints(
                    betType === "number" ? parseInt(betAmount) * 35 :
                    betType === "dozen" ? parseInt(betAmount) * 2 :
                    parseInt(betAmount)
                  )} pts
                </p>
              )}
            </div>

            <button onClick={spin} disabled={spinning || !parseInt(betAmount)}
              className="w-full btn-primary disabled:opacity-40 py-3">
              {spinning ? "Spinning..." : "🎡 Spin"}
            </button>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        )}

        <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 space-y-1">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Rules</p>
          <p className="text-xs text-slate-500">European roulette. 0 is green — all bets except straight 0 lose. Numbers 1-36 alternate red/black.</p>
          <p className="text-xs text-slate-600 mt-1">Bet all your points for the All Your Chips achievement.</p>
        </div>
      </div>
      <Navbar />
    </div>
  );
}
