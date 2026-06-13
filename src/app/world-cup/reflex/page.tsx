"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ZONE_GRID, ZONE_LABELS, ZONE_NAMES, Zone } from "@/lib/worldCupMiniGames";

type Opponent = {
  name: string;
  type: "player" | "bot";
  flag: string;
  botSubtype: "house" | "shark" | "momentum" | null;
};

type KickSummary = { kick: Zone; answer: Zone | null; saved: boolean };

type PageState =
  | { phase: "loading" }
  | { phase: "already"; lastResult: { opponentName: string; saves: number; kicks: Zone[]; answers: (Zone | null)[] } | null; lastCans: number }
  | { phase: "ready"; opponent: Opponent; kicks: Zone[]; token: string; ts: number; flashMs: number }
  | { phase: "countdown"; opponent: Opponent; kicks: Zone[]; token: string; ts: number; flashMs: number; count: number }
  | { phase: "playing"; opponent: Opponent; kicks: Zone[]; token: string; ts: number; flashMs: number; kickIndex: number; activeZone: Zone | null; answers: (Zone | null)[] }
  | { phase: "submitting"; opponent: Opponent; kicks: Zone[]; token: string; ts: number; answers: (Zone | null)[] }
  | { phase: "done"; opponent: Opponent; summary: KickSummary[]; saves: number; cansEarned: number }
  | { phase: "error"; message: string };

function ZoneGrid({ onTap, activeZone, disabled }: {
  onTap?: (z: Zone) => void;
  activeZone?: Zone | null;
  disabled?: boolean;
}) {
  return (
    <div className="border-2 border-white/20 rounded-lg overflow-hidden">
      {ZONE_GRID.map((row, ri) => (
        <div key={ri} className={`grid grid-cols-3 ${ri === 0 ? "border-b border-white/10" : ""}`}>
          {row.map((zone) => {
            const isFlashing = activeZone === zone;
            const base = "aspect-square flex items-center justify-center text-3xl font-bold transition-all select-none border-r last:border-r-0 border-white/10";
            const color = isFlashing
              ? "bg-rose-500/70 text-white scale-95 animate-pulse"
              : onTap
              ? "bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 cursor-pointer active:scale-95 text-slate-400"
              : "bg-white/5 text-slate-700";
            return (
              <button
                key={zone}
                onClick={() => onTap?.(zone)}
                disabled={disabled}
                className={`${base} ${color}`}
              >
                {ZONE_LABELS[zone]}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ReflexPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const answerRef = useRef<Zone | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => { if (!r.ok) router.push("/login"); });
    fetch("/api/world-cup/reflex")
      .then((r) => r.json())
      .then((d) => {
        if (d.alreadyPlayed) {
          setState({ phase: "already", lastResult: d.lastResult, lastCans: d.lastCans });
        } else {
          setState({
            phase: "ready",
            opponent: d.opponent,
            kicks: d.kicks,
            token: d.token,
            ts: d.ts,
            flashMs: d.flashMs,
          });
        }
      })
      .catch(() => setState({ phase: "error", message: "Failed to load — try again" }));
  }, [router]);

  const startCountdown = () => {
    if (state.phase !== "ready") return;
    const { opponent, kicks, token, ts, flashMs } = state;
    setState({ phase: "countdown", opponent, kicks, token, ts, flashMs, count: 3 });

    let c = 3;
    const tick = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(tick);
        beginSequence(opponent, kicks, token, ts, flashMs);
      } else {
        setState((s) => s.phase === "countdown" ? { ...s, count: c } : s);
      }
    }, 800);
  };

  const beginSequence = async (
    opponent: Opponent,
    kicks: Zone[],
    token: string,
    ts: number,
    flashMs: number
  ) => {
    const collectedAnswers: (Zone | null)[] = [];

    for (let i = 0; i < kicks.length; i++) {
      answerRef.current = null;
      setState({
        phase: "playing",
        opponent,
        kicks,
        token,
        ts,
        flashMs,
        kickIndex: i,
        activeZone: kicks[i],
        answers: [...collectedAnswers],
      });

      await new Promise<void>((r) => setTimeout(r, flashMs));

      const answer = answerRef.current;
      collectedAnswers.push(answer);

      // Brief blank between kicks
      setState((s) =>
        s.phase === "playing" ? { ...s, activeZone: null } : s
      );
      await new Promise<void>((r) => setTimeout(r, 500));
    }

    // Submit
    setState({ phase: "submitting", opponent, kicks, token, ts, answers: collectedAnswers });

    try {
      const res = await fetch("/api/world-cup/reflex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opponentName: opponent.name,
          opponentType: opponent.type,
          kicks,
          token,
          ts,
          answers: collectedAnswers,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setState({ phase: "error", message: d.error ?? "Failed" }); return; }

      const summary: KickSummary[] = kicks.map((kick, i) => ({
        kick,
        answer: collectedAnswers[i],
        saved: collectedAnswers[i] === kick,
      }));

      setState({ phase: "done", opponent, summary, saves: d.saves, cansEarned: d.cansEarned });
    } catch {
      setState({ phase: "error", message: "Something went wrong submitting your result" });
    }
  };

  const handleZoneTap = (zone: Zone) => {
    if (state.phase !== "playing" || state.activeZone === null) return;
    answerRef.current = zone;
  };

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
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">🧤 Keeper&apos;s Reflex</h1>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
          <div className="card text-center space-y-2 bg-slate-500/10">
            <p className="text-3xl">🌙</p>
            <p className="font-bold text-white">Already played today</p>
            <p className="text-slate-400 text-sm">Come back tomorrow to face a new opponent.</p>
          </div>
          {lastResult && (
            <div className="card space-y-3">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                Last Result — vs {lastResult.opponentName} · {lastResult.saves}/5 Saves · {lastCans} 🥤
              </p>
              {lastResult.kicks.map((kick, i) => {
                const answer = lastResult.answers[i];
                const saved = answer === kick;
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm text-white font-medium">Kick {i + 1} — <span className="font-mono">{ZONE_NAMES[kick]}</span></p>
                      <p className="text-xs text-slate-500">You dove: <span className="font-mono">{answer ? ZONE_NAMES[answer] : "No reaction"}</span></p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg font-mono ${saved ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                      {saved ? "SAVE 🧤" : "GOAL ⚽"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Navbar />
      </div>
    );
  }

  if (state.phase === "ready") {
    const { opponent, flashMs } = state;
    const isHouse = opponent.botSubtype === "house";
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">🧤 Keeper&apos;s Reflex</h1>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
          {/* Opponent card */}
          <div className={`card text-center space-y-3 ${isHouse ? "bg-amber-500/10 border-amber-500/30" : "bg-violet-500/10 border-violet-500/30"}`}>
            <p className="text-5xl">{opponent.flag}</p>
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-widest font-mono text-xs">
                {opponent.type === "player" ? "Facing opponent" : "Bot challenge"}
              </p>
              <p className="text-white font-bold text-xl">{opponent.name}</p>
              {opponent.type === "player"
                ? <p className="text-xs text-slate-500">Their last 5 shootout kicks are incoming</p>
                : <p className="text-xs text-slate-500">{isHouse ? "Corners only · flash window reduced" : "Bot-generated kicks"}</p>
              }
            </div>
          </div>

          {isHouse && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-300 space-y-1">
              <p className="font-bold">⚠️ The House Advantage</p>
              <p>The House only kicks to corners — no centre shots. And the flash window is {flashMs}ms instead of 500ms. React faster.</p>
            </div>
          )}

          <div className="card bg-white/5 border-white/10 text-xs text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-300">How to play</p>
            <p>A zone on the goal will flash briefly. Tap it to make the save.</p>
            <p>3 saves = 4 🥤 · 4 saves = 6 🥤 · 5 saves = 10 🥤</p>
          </div>

          <button onClick={startCountdown} className="btn-primary w-full text-lg py-4">
            Ready — Start! 🧤
          </button>
        </div>
        <Navbar />
      </div>
    );
  }

  if (state.phase === "countdown") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pb-20 gap-6">
        <p className="text-slate-400 text-sm">Get ready…</p>
        <p className="text-8xl font-black text-white font-mono animate-pulse">{state.count}</p>
        <Navbar />
      </div>
    );
  }

  if (state.phase === "playing" || state.phase === "submitting") {
    const { kicks, kickIndex } = state as { kicks: Zone[]; kickIndex: number };
    const activeZone = state.phase === "playing" ? (state as { activeZone: Zone | null }).activeZone : null;

    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">🧤 Keeper&apos;s Reflex</h1>
            <p className="text-sm font-mono text-slate-400">Kick {kickIndex + 1} / {kicks.length}</p>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
          <div className="flex justify-center gap-1.5">
            {kicks.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                i < kickIndex ? "bg-violet-500" :
                i === kickIndex ? "bg-white animate-pulse" :
                "bg-white/10"
              }`} />
            ))}
          </div>

          <div className="text-center">
            <p className={`text-lg font-bold transition-all ${activeZone ? "text-rose-300" : "text-slate-600"}`}>
              {activeZone ? "↑ INCOMING — TAP IT! ↑" : "·"}
            </p>
          </div>

          <ZoneGrid onTap={handleZoneTap} activeZone={activeZone} />

          <p className="text-center text-xs text-slate-600">
            {activeZone ? `Flash window open…` : "Preparing next kick…"}
          </p>
        </div>
        <Navbar />
      </div>
    );
  }

  if (state.phase === "done") {
    const { opponent, summary, saves, cansEarned } = state;
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">🧤 Keeper&apos;s Reflex</h1>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
          {/* Score card */}
          <div className={`card text-center space-y-2 ${
            saves >= 4 ? "bg-emerald-500/10 border-emerald-500/30" :
            saves >= 3 ? "bg-amber-500/10 border-amber-500/30" :
            "bg-rose-500/10 border-rose-500/30"
          }`}>
            <p className="text-3xl">{saves >= 4 ? "🧤" : saves >= 3 ? "⚡" : "⚽"}</p>
            <p className="font-bold text-white text-xl">{saves}/5 Saves</p>
            <p className="text-slate-400 text-sm">vs {opponent.flag} {opponent.name}</p>
            {cansEarned > 0
              ? <p className="text-emerald-400 font-mono text-sm">+{cansEarned} 🥤 earned</p>
              : <p className="text-slate-500 text-sm">Save 3+ to earn Monitor Cans</p>
            }
          </div>

          {/* Kick breakdown */}
          <div className="card space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Kick Breakdown</p>
            {summary.map((k, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white font-medium">
                    Kick {i + 1} — <span className="font-mono">{ZONE_NAMES[k.kick]}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    You dove: <span className="font-mono">{k.answer ? ZONE_NAMES[k.answer] : "No reaction"}</span>
                  </p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg font-mono ${k.saved ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                  {k.saved ? "SAVE 🧤" : "GOAL ⚽"}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Link href="/world-cup/shootout" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
              <span className="text-3xl">⚽</span>
              <div>
                <p className="font-semibold text-white">Penalty Shootout →</p>
                <p className="text-xs text-slate-500">Your kicks are locked in for others to face</p>
              </div>
            </Link>
            <Link href="/world-cup/standings" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
              <span className="text-3xl">📊</span>
              <div>
                <p className="font-semibold text-white">Mini Game Standings →</p>
              </div>
            </Link>
          </div>
        </div>
        <Navbar />
      </div>
    );
  }

  return null;
}
