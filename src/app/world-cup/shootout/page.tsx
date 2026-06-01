"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ZONE_GRID, ZONE_LABELS, ZONE_NAMES, Zone } from "@/lib/worldCupMiniGames";

type KickResult = { pick: Zone; keeperZone: Zone; goal: boolean };

type PageState =
  | { phase: "loading" }
  | { phase: "already"; lastResult: { picks: Zone[]; keeperZones: Zone[]; score: number }; lastCans: number }
  | { phase: "selecting" }
  | { phase: "submitting" }
  | { phase: "revealing"; kicks: KickResult[]; score: number; cansEarned: number; revealed: number }
  | { phase: "done"; kicks: KickResult[]; score: number; cansEarned: number; achievementUnlocked: boolean }
  | { phase: "error"; message: string };

export default function ShootoutPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [picks, setPicks] = useState<Zone[]>([]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => { if (!r.ok) router.push("/login"); });
    fetch("/api/world-cup/shootout")
      .then((r) => r.json())
      .then((d) => {
        if (d.alreadyPlayed) {
          setState({ phase: "already", lastResult: d.lastResult, lastCans: d.lastCans });
        } else {
          setState({ phase: "selecting" });
        }
      })
      .catch(() => setState({ phase: "error", message: "Failed to load — try again" }));
  }, [router]);

  const addPick = (zone: Zone) => {
    if (picks.length >= 5) return;
    setPicks((p) => [...p, zone]);
  };

  const removeLast = () => setPicks((p) => p.slice(0, -1));

  const shoot = async () => {
    if (picks.length !== 5) return;
    setState({ phase: "submitting" });
    try {
      const res = await fetch("/api/world-cup/shootout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks }),
      });
      const d = await res.json();
      if (!res.ok) { setState({ phase: "error", message: d.error ?? "Failed" }); return; }

      // Stagger reveal
      setState({ phase: "revealing", kicks: d.kicks, score: d.score, cansEarned: d.cansEarned, revealed: 0 });
      for (let i = 1; i <= d.kicks.length; i++) {
        await new Promise<void>((r) => setTimeout(r, 650));
        setState((s) =>
          s.phase === "revealing" ? { ...s, revealed: i } : s
        );
      }
      await new Promise<void>((r) => setTimeout(r, 400));
      setState({ phase: "done", kicks: d.kicks, score: d.score, cansEarned: d.cansEarned, achievementUnlocked: d.achievementUnlocked ?? false });
    } catch {
      setState({ phase: "error", message: "Something went wrong" });
    }
  };

  function ZoneGrid({
    onPick,
    disabled,
    highlight,
    keeperHighlight,
  }: {
    onPick?: (z: Zone) => void;
    disabled?: boolean;
    highlight?: Zone | null;
    keeperHighlight?: Zone | null;
  }) {
    return (
      <div className="relative">
        {/* Goal posts */}
        <div className="border-2 border-white/20 rounded-lg overflow-hidden">
          {ZONE_GRID.map((row, ri) => (
            <div key={ri} className={`grid grid-cols-3 ${ri === 0 ? "border-b border-white/10" : ""}`}>
              {row.map((zone) => {
                const isShot = highlight === zone;
                const isKeeper = keeperHighlight === zone;
                const base = "aspect-square flex items-center justify-center text-2xl font-bold transition-all select-none border-r last:border-r-0 border-white/10";
                const color = isShot && isKeeper
                  ? "bg-amber-500/40 text-amber-300"
                  : isShot
                  ? "bg-emerald-500/40 text-emerald-300"
                  : isKeeper
                  ? "bg-rose-500/30 text-rose-400"
                  : onPick
                  ? "bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 cursor-pointer active:scale-95 text-slate-400"
                  : "bg-white/5 text-slate-600";
                return (
                  <button
                    key={zone}
                    onClick={() => onPick?.(zone)}
                    disabled={disabled || !onPick}
                    className={`${base} ${color}`}
                  >
                    {ZONE_LABELS[zone]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {/* Zone legend below */}
        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          {ZONE_GRID.flat().map((z) => (
            <p key={z} className="text-[10px] text-slate-600 font-mono">{ZONE_NAMES[z]}</p>
          ))}
        </div>
      </div>
    );
  }

  if (state.phase === "loading") return null;

  if (state.phase === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pb-20 px-4">
        <p className="text-rose-400 text-sm">{state.message}</p>
        <Link href="/world-cup" className="mt-4 text-violet-400 text-sm">← Back</Link>
        <Navbar />
      </div>
    );
  }

  if (state.phase === "already") {
    const { lastResult, lastCans } = state;
    const kicks: KickResult[] = lastResult
      ? lastResult.picks.map((pick, i) => ({
          pick,
          keeperZone: lastResult.keeperZones[i],
          goal: pick !== lastResult.keeperZones[i],
        }))
      : [];
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">⚽ Penalty Shootout</h1>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
          <div className="card text-center space-y-2 bg-slate-500/10">
            <p className="text-3xl">🌙</p>
            <p className="font-bold text-white">Already played today</p>
            <p className="text-slate-400 text-sm">Come back tomorrow for another shot.</p>
          </div>
          {kicks.length > 0 && (
            <div className="card space-y-3">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Last Result — {lastResult.score}/5 Goals · {lastCans} 🥤</p>
              {kicks.map((k, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <p className="text-sm text-slate-300">Kick {i + 1} — <span className="font-mono">{ZONE_NAMES[k.pick]}</span></p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg font-mono ${k.goal ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                    {k.goal ? "GOAL ⚽" : "SAVED 🧤"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/world-cup/reflex" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
            <span className="text-3xl">🧤</span>
            <div>
              <p className="font-semibold text-white">Try Keeper&apos;s Reflex →</p>
              <p className="text-xs text-slate-500">Face another player&apos;s actual kicks</p>
            </div>
          </Link>
        </div>
        <Navbar />
      </div>
    );
  }

  if (state.phase === "selecting" || state.phase === "submitting") {
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <div>
              <h1 className="text-lg font-bold text-white">⚽ Penalty Shootout</h1>
              <p className="text-xs text-slate-500">Pick a zone for each of your 5 kicks</p>
            </div>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
          <div className="card bg-amber-500/5 border-amber-500/20 text-xs text-amber-300 text-center">
            🏦 The House has been watching your tendencies. Choose wisely.
          </div>

          <ZoneGrid onPick={addPick} disabled={state.phase === "submitting" || picks.length >= 5} />

          {/* Kick slots */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Your Kicks</p>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`rounded-xl border py-3 text-center text-sm font-mono font-bold transition-all ${
                  picks[i]
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                    : "bg-white/5 border-white/10 text-slate-700"
                }`}>
                  {picks[i] ? ZONE_LABELS[picks[i]] : (i + 1)}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 text-center">{picks.length}/5 selected</p>
          </div>

          <div className="flex gap-3">
            {picks.length > 0 && state.phase !== "submitting" && (
              <button onClick={removeLast} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm hover:text-white transition-colors">
                Undo
              </button>
            )}
            <button
              onClick={shoot}
              disabled={picks.length !== 5 || state.phase === "submitting"}
              className="flex-1 btn-primary"
            >
              {state.phase === "submitting" ? "Shooting..." : picks.length === 5 ? "Shoot! ⚽" : `Select ${5 - picks.length} more`}
            </button>
          </div>
        </div>
        <Navbar />
      </div>
    );
  }

  if (state.phase === "revealing" || state.phase === "done") {
    const { kicks, score, cansEarned } = state;
    const revealed = state.phase === "revealing" ? state.revealed : kicks.length;

    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">⚽ Penalty Shootout</h1>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
          {state.phase === "done" && (
            <div className={`card text-center space-y-2 ${
              score >= 4 ? "bg-emerald-500/10 border-emerald-500/30" :
              score >= 3 ? "bg-amber-500/10 border-amber-500/30" :
              "bg-rose-500/10 border-rose-500/30"
            }`}>
              <p className="text-3xl">{score >= 4 ? "🔥" : score >= 3 ? "⚽" : "🏦"}</p>
              <p className="font-bold text-white text-xl">{score}/5 Goals</p>
              {cansEarned > 0
                ? <p className="text-emerald-400 font-mono text-sm">+{cansEarned} 🥤 earned</p>
                : <p className="text-slate-500 text-sm">Score 3+ to earn Monitor Cans</p>
              }
              {score < 3 && <p className="text-amber-300 text-xs">The House read your tendencies. Next time, mix it up.</p>}
            </div>
          )}

          <div className="card space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Kick by Kick</p>
            {kicks.map((k, i) => (
              <div
                key={i}
                className={`flex items-center justify-between py-2 border-b border-white/5 last:border-0 transition-all duration-500 ${
                  i < revealed ? "opacity-100" : "opacity-0"
                }`}
              >
                <div>
                  <p className="text-sm text-white font-medium">Kick {i + 1} — <span className="font-mono text-slate-300">{ZONE_NAMES[k.pick]}</span></p>
                  <p className="text-xs text-slate-500">Keeper dove: <span className="font-mono">{ZONE_NAMES[k.keeperZone]}</span></p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg font-mono ${k.goal ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                  {k.goal ? "GOAL ⚽" : "SAVED 🧤"}
                </span>
              </div>
            ))}
          </div>

          {state.phase === "done" && state.achievementUnlocked && (
            <div className="card bg-amber-500/10 border-amber-500/30 text-center space-y-1 py-4">
              <p className="text-2xl">🥅</p>
              <p className="font-bold text-white">Achievement Unlocked — Off Script</p>
              <p className="text-xs text-amber-300">+3 🥤 added · Claim 300 pts on the Achievements page</p>
              <Link href="/achievements" className="text-xs text-violet-400 underline">Go to Achievements →</Link>
            </div>
          )}

          {state.phase === "done" && (
            <div className="space-y-2">
              <Link href="/world-cup/reflex" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
                <span className="text-3xl">🧤</span>
                <div>
                  <p className="font-semibold text-white">Keeper&apos;s Reflex →</p>
                  <p className="text-xs text-slate-500">Your kicks are now saved — someone may face them today</p>
                </div>
              </Link>
              <Link href="/world-cup/standings" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
                <span className="text-3xl">📊</span>
                <div>
                  <p className="font-semibold text-white">Mini Game Standings →</p>
                  <p className="text-xs text-slate-500">See where you rank</p>
                </div>
              </Link>
            </div>
          )}
        </div>
        <Navbar />
      </div>
    );
  }

  return null;
}
