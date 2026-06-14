"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type GameType = "roulette" | "blackjack" | "custom";

type BigBetEntry = {
  id: number;
  username: string;
  isMe: boolean;
  title: string;
  description: string;
  gameType: GameType;
  stake: number;
  multiplier: number;
  isAllIn: boolean;
  outcome: "win" | "loss" | null;
  payout: number | null;
  status: string;
  createdAt: string;
};

type BigBetStatus = {
  casinoActive: boolean;
  revealAt: string | null;
  showRevealed: boolean;
  myPoints: number;
  myPendingBet: {
    id: number; title: string; description: string;
    stake: number; gameType: GameType; isAllIn: boolean; multiplier: number;
  } | null;
  bets: BigBetEntry[];
};

const GAME_ICONS: Record<GameType, string> = {
  roulette: "🎡",
  blackjack: "🃏",
  custom: "🎲",
};

const GAME_LABELS: Record<GameType, string> = {
  roulette: "Roulette",
  blackjack: "Blackjack",
  custom: "Custom",
};

const GAME_HINTS: Record<GameType, string> = {
  roulette: "Describe your roulette bet — e.g. 'Red on the first spin of the night'",
  blackjack: "Describe your blackjack wager — e.g. 'I'll win the hand with a natural 21'",
  custom: "Describe anything you predict will happen during Casino Night",
};

const SHODAN_REVEAL_LINES = [
  "Processing. Processing. I remember every transaction.",
  "Your confidence was... noted. Let's see if it was warranted.",
  "The outcome has been determined. I determined it. You simply had not been informed yet.",
  "Every bet is data. I have been feasting.",
];

export default function BigBetPage() {
  const router = useRouter();
  const [status, setStatus] = useState<BigBetStatus | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState("");
  const [gameType, setGameType] = useState<GameType>("roulette");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [revealIndex, setRevealIndex] = useState(0);
  const [showingReveal, setShowingReveal] = useState(false);
  const [shodanLine] = useState(() => SHODAN_REVEAL_LINES[Math.floor(Math.random() * SHODAN_REVEAL_LINES.length)]);

  const load = useCallback(() =>
    fetch("/api/casino/big-bet")
      .then((r) => r.json())
      .then(setStatus), []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) router.push("/login"); return r.ok ? r.json() : null; })
      .then((u) => { if (u) load(); });
  }, [router, load]);

  const stakeNum = parseInt(stake) || 0;
  const isAllIn = status ? stakeNum === status.myPoints : false;
  const multiplier = isAllIn ? 2.0 : 1.5;

  const allIn = () => { if (status) setStake(String(status.myPoints)); };

  const submit = async () => {
    if (!title.trim() || !description.trim() || !stakeNum) {
      setError("Fill in all fields");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/casino/big-bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), stake: stakeNum, gameType }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setTitle(""); setDescription(""); setStake("");
      load();
    } else {
      setError(d.error ?? "Something went wrong");
    }
  };

  if (!status) return null;

  const { casinoActive, revealAt, showRevealed, myPoints, myPendingBet, bets } = status;
  const revealBets = showRevealed ? bets : [];
  const currentReveal = revealBets[revealIndex] ?? null;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/casino-night" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">📺 Big Bet Show</h1>
          </div>
          <PointsBadge points={myPoints} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Show mode — revealed */}
        {showRevealed && revealBets.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/20 px-5 py-4">
              <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2">SHODAN</p>
              <p className="text-sm text-emerald-200 italic">"{shodanLine}"</p>
            </div>

            {!showingReveal ? (
              <button
                onClick={() => { setRevealIndex(0); setShowingReveal(true); }}
                className="w-full btn-primary py-4 text-lg"
              >
                📺 Start the Show
              </button>
            ) : (
              <div className="space-y-4">
                {currentReveal && (
                  <div className={`rounded-2xl border p-5 text-center space-y-3 ${
                    currentReveal.outcome === "win"
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-rose-500/10 border-rose-500/40"
                  }`}>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                      {GAME_ICONS[currentReveal.gameType]} {GAME_LABELS[currentReveal.gameType]}
                      {" · "}Bet {revealIndex + 1} of {revealBets.length}
                    </p>
                    <p className="text-xl font-bold text-white">{currentReveal.username}</p>
                    {currentReveal.isAllIn && (
                      <p className="text-xs font-mono text-rose-400 uppercase tracking-widest">🔥 All In — ×{currentReveal.multiplier}</p>
                    )}
                    <p className="text-lg text-slate-200">"{currentReveal.title}"</p>
                    <p className="text-sm text-slate-400">{currentReveal.description}</p>
                    <p className="text-sm text-slate-400">Stake: {formatPoints(currentReveal.stake)} pts</p>
                    <div className="pt-2">
                      {currentReveal.outcome === "win" ? (
                        <>
                          <p className="text-3xl font-black text-emerald-400">WIN</p>
                          <p className="text-lg text-white font-bold">
                            +{formatPoints((currentReveal.payout ?? 0) - currentReveal.stake)} pts profit
                          </p>
                          <p className="text-xs text-slate-500">{formatPoints(currentReveal.payout ?? 0)} pts returned · ×{currentReveal.multiplier}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-3xl font-black text-rose-400">LOSS</p>
                          <p className="text-sm text-slate-400">The House thanks you for your contribution.</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {revealIndex > 0 && (
                    <button onClick={() => setRevealIndex((i) => i - 1)} className="flex-1 rounded-xl border border-white/10 py-2 text-slate-400 text-sm">
                      ← Back
                    </button>
                  )}
                  {revealIndex < revealBets.length - 1 ? (
                    <button onClick={() => setRevealIndex((i) => i + 1)} className="flex-1 btn-primary">
                      Next →
                    </button>
                  ) : (
                    <button onClick={() => setShowingReveal(false)} className="flex-1 btn-primary">
                      Done
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            {!showingReveal && (
              <div className="space-y-2">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Results</p>
                {revealBets.map((b) => (
                  <div key={b.id} className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                    b.outcome === "win" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{GAME_ICONS[b.gameType]}</span>
                        <p className="text-sm font-semibold text-white">{b.username}</p>
                        {b.isAllIn && <span className="text-xs text-rose-400">ALL IN</span>}
                      </div>
                      <p className="text-xs text-slate-400">{b.title}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${b.outcome === "win" ? "text-emerald-400" : "text-rose-400"}`}>
                        {b.outcome === "win" ? `+${formatPoints((b.payout ?? 0) - b.stake)}` : `-${formatPoints(b.stake)}`}
                      </p>
                      <p className="text-xs text-slate-600">×{b.multiplier}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submission phase */}
        {!showRevealed && casinoActive && (
          <>
            {revealAt && (
              <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-center">
                <p className="text-xs font-mono text-slate-500 uppercase">Tonight's reveal</p>
                <p className="text-sm text-white font-semibold">
                  {new Date(revealAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-slate-600">Submit before then. Once The House resolves it, it waits for no one.</p>
              </div>
            )}

            {myPendingBet ? (
              <div className="rounded-2xl bg-violet-500/10 border border-violet-500/30 px-4 py-4 space-y-2">
                <p className="text-xs font-mono text-violet-400 uppercase tracking-widest">Your Submission</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{GAME_ICONS[myPendingBet.gameType]}</span>
                  <p className="text-sm font-bold text-white">{myPendingBet.title}</p>
                </div>
                <p className="text-xs text-slate-400">{myPendingBet.description}</p>
                <p className="text-xs text-slate-500">
                  {formatPoints(myPendingBet.stake)} pts escrowed
                  {" · "}
                  {myPendingBet.isAllIn
                    ? <span className="text-rose-400 font-semibold">ALL IN × {myPendingBet.multiplier}</span>
                    : <span>×{myPendingBet.multiplier} if you win</span>
                  }
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-4">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Submit a Bet</p>

                {/* Game type */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Game</p>
                  <div className="flex gap-2">
                    {(["roulette", "blackjack", "custom"] as GameType[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGameType(g)}
                        className={`flex-1 rounded-xl border py-2 text-sm transition-colors ${
                          gameType === g
                            ? "bg-violet-500/20 border-violet-500/50 text-white"
                            : "bg-white/5 border-white/10 text-slate-400"
                        }`}
                      >
                        {GAME_ICONS[g]} {GAME_LABELS[g]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600">{GAME_HINTS[gameType]}</p>
                </div>

                <input
                  type="text"
                  placeholder="Title — short summary of the bet"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
                />
                <textarea
                  placeholder="Description — spell out the exact terms..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50 resize-none"
                />

                {/* Stake + all-in */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="50"
                      max={myPoints}
                      placeholder="Stake (min 50 pts)"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                      onClick={allIn}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-400 text-sm hover:bg-rose-500/20 transition-colors"
                    >
                      All In
                    </button>
                  </div>

                  {stakeNum > 0 && (
                    <div className={`rounded-xl border px-3 py-2 text-xs space-y-0.5 ${
                      isAllIn ? "bg-rose-500/10 border-rose-500/30" : "bg-white/3 border-white/5"
                    }`}>
                      {isAllIn ? (
                        <>
                          <p className="text-rose-400 font-semibold">🔥 ALL IN — ×2.0 multiplier</p>
                          <p className="text-slate-400">Win: +{formatPoints(stakeNum)} pts profit ({formatPoints(stakeNum * 2)} returned)</p>
                        </>
                      ) : (
                        <>
                          <p className="text-slate-400">×1.5 multiplier</p>
                          <p className="text-slate-400">Win: +{formatPoints(Math.floor(stakeNum * 0.5))} pts profit ({formatPoints(Math.floor(stakeNum * 1.5))} returned)</p>
                          <p className="text-slate-600">Stake all {formatPoints(myPoints)} pts for ×2.0</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={submit}
                  disabled={submitting || !title.trim() || !description.trim() || stakeNum < 50}
                  className="w-full btn-primary disabled:opacity-40"
                >
                  {submitting ? "Submitting..." : "Submit to the Show"}
                </button>
                {error && <p className="text-xs text-rose-400">{error}</p>}
              </div>
            )}

            {/* Pending bets from other players */}
            {bets.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Tonight's Submissions</p>
                {bets.map((b) => (
                  <div key={b.id} className={`rounded-xl border px-4 py-3 ${
                    b.isMe ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.03] border-white/8"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{GAME_ICONS[b.gameType]}</span>
                          <p className="text-sm font-semibold text-white">{b.username}</p>
                          {b.isMe && <span className="text-violet-400 text-xs">(you)</span>}
                          {b.isAllIn && <span className="text-xs text-rose-400 font-semibold">ALL IN</span>}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">"{b.title}"</p>
                        <p className="text-xs text-slate-500">{b.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-400 font-mono">{formatPoints(b.stake)}</p>
                        <p className="text-xs text-slate-600">×{b.multiplier}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!casinoActive && !showRevealed && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-center">
            <p className="text-slate-400 text-sm">Casino Night is not currently active.</p>
          </div>
        )}
      </div>
      <Navbar />
    </div>
  );
}
