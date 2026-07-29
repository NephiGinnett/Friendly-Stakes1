"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";
import { BIG_BET_GAMES } from "@/lib/casinoNight";

type BigBetStatus = {
  casinoActive: boolean;
  revealAt: string | null;
  selectedGame: string | null;
  myPoints: number;
  myBet: {
    id: number; stake: number; multiplier: number; isAllIn: boolean; status: string; gameType: string;
  } | null;
  biggestBet: { username: string; stake: number; isAllIn: boolean } | null;
  approvedBet: {
    id: number; username: string; userId: number;
    stake: number; multiplier: number; isAllIn: boolean; gameType: string;
  } | null;
  completedBets: {
    id: number; username: string; stake: number;
    outcome: string; payout: number; multiplier: number;
  }[];
  pendingCount: number;
};

const GAME_ICONS: Record<string, string> = {
  roulette: "🎡", blackjack: "🃏", slots: "🎰", custom: "🎲",
};

function Countdown({ target }: { target: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setText("LIVE NOW"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setText(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return <span className="font-mono text-amber-400">{text}</span>;
}

export default function BigBetPage() {
  const router = useRouter();
  const [status, setStatus] = useState<BigBetStatus | null>(null);
  const [stake, setStake] = useState("");
  const [chosenGame, setChosenGame] = useState<string>("roulette");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() =>
    fetch("/api/casino/big-bet")
      .then((r) => r.json())
      .then(setStatus), []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) router.push("/login"); return r.ok ? r.json() : null; })
      .then((u) => { if (u) load(); });
  }, [router, load]);

  // Poll so the VIP selection, countdown, and win/loss resolution appear live
  // for players without a manual refresh.
  useEffect(() => {
    const id = setInterval(() => { load(); }, 5000);
    return () => clearInterval(id);
  }, [load]);

  const submit = async () => {
    const amt = parseInt(stake);
    if (!amt || amt < 50) { setError("Minimum stake is 50 points"); return; }
    setSubmitting(true); setError("");

    const res = await fetch("/api/casino/big-bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stake: amt, gameType: chosenGame }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setStake("");
      load();
    } else {
      setError(d.error ?? "Something went wrong");
    }
  };

  if (!status) return null;

  const isVIP = status.myBet?.status === "approved";
  const spotlightBet = status.approvedBet ?? status.biggestBet;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/casino-night" className="text-slate-400 hover:text-white text-sm">&larr;</Link>
            <h1 className="text-lg font-bold text-white">📺 Strike It Rich</h1>
          </div>
          <PointsBadge points={status.myPoints} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* VIP Ticket Banner */}
        {isVIP && (
          <div className="rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 p-5 text-center space-y-3 animate-pulse">
            <p className="text-3xl">🎟️</p>
            <p className="text-xl font-black text-amber-400">YOU HAVE BEEN SELECTED</p>
            <p className="text-sm text-slate-300">
              Your submission has been approved for tonight&rsquo;s live show.
              {status.myBet && (
                <span className="block mt-1 text-white font-bold">
                  {formatPoints(status.myBet.stake)} pts at ×{status.myBet.multiplier}
                  {status.myBet.isAllIn && " — ALL IN"}
                </span>
              )}
            </p>
            {status.myBet?.gameType && (
              <p className="text-sm text-amber-300">
                Your game: {GAME_ICONS[status.myBet.gameType] ?? "🎲"} {status.myBet.gameType.charAt(0).toUpperCase() + status.myBet.gameType.slice(1)}
              </p>
            )}
            {status.revealAt && (
              <p className="text-sm text-slate-400">
                Show time: <Countdown target={status.revealAt} />
              </p>
            )}
            <p className="text-xs text-slate-500">Stand by. The House will call you to the stage.</p>
          </div>
        )}

        {/* Current Spotlight */}
        {!isVIP && spotlightBet && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5 text-center space-y-2">
            <p className="text-xs font-mono text-rose-400 uppercase tracking-widest">
              {status.approvedBet ? "🎟️ Tonight's VIP" : "🔥 Current Leader"}
            </p>
            <p className="text-xl font-black text-white">{spotlightBet.username}</p>
            <p className="text-lg font-bold text-amber-400">
              {formatPoints(spotlightBet.stake)} pts
              {spotlightBet.isAllIn && <span className="ml-2 text-sm bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full">ALL IN</span>}
            </p>
            {status.revealAt && (
              <p className="text-sm text-slate-400">Live show: <Countdown target={status.revealAt} /></p>
            )}
            {status.pendingCount > 1 && (
              <p className="text-xs text-slate-600">{status.pendingCount} submissions competing</p>
            )}
          </div>
        )}

        {/* Submission form — simplified: just stake */}
        {!status.myBet && !status.approvedBet && status.casinoActive && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <div>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">Strike It Rich</p>
              <p className="text-sm text-slate-400 mb-4">
                Put your points on the line. The House selects one player for the live show tonight.
                Everyone else gets their points back. Go all-in for ×5.
              </p>
            </div>

            <div>
              <label className="label">Your game</label>
              <p className="text-xs text-slate-500 mb-2">Pick the game you&rsquo;ll play live on stage if you&rsquo;re selected.</p>
              <div className="flex gap-2">
                {BIG_BET_GAMES.map((g) => (
                  <button key={g.id} type="button" onClick={() => setChosenGame(g.id)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      chosenGame === g.id
                        ? "bg-violet-500/20 border-violet-500/50 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    }`}>
                    {g.emoji} {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Stake</label>
              <div className="flex gap-2">
                <input type="number" min="50" max={status.myPoints} value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  placeholder="Min 50 pts..." className="input flex-1" />
                <button onClick={() => setStake(String(status?.myPoints ?? 0))}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-rose-400 text-sm hover:bg-rose-500/20 transition-colors font-semibold">
                  ALL IN
                </button>
              </div>
              {parseInt(stake) > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  {parseInt(stake) === status.myPoints ? (
                    <span className="text-rose-400 font-bold">ALL IN — ×5 multiplier → {formatPoints(parseInt(stake) * 5)} pts if you win</span>
                  ) : (
                    <span>×3 multiplier → {formatPoints(parseInt(stake) * 3)} pts if you win</span>
                  )}
                </p>
              )}
            </div>

            <button onClick={submit} disabled={submitting}
              className="w-full btn-primary disabled:opacity-40 py-3 text-base">
              {submitting ? "Submitting..." : "🎰 Strike It Rich"}
            </button>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        )}

        {/* Pending bet (not yet approved) */}
        {status.myBet && status.myBet.status === "pending" && (
          <div className="rounded-2xl bg-violet-500/10 border border-violet-500/30 p-5 space-y-2">
            <p className="text-xs font-mono text-violet-400 uppercase tracking-widest">Your Submission</p>
            <p className="text-sm text-slate-300">
              {formatPoints(status.myBet.stake)} pts escrowed · ×{status.myBet.multiplier}
              {status.myBet.isAllIn && " · ALL IN"}
            </p>
            {status.myBet.gameType && (
              <p className="text-xs text-slate-400">
                Your game: {GAME_ICONS[status.myBet.gameType] ?? "🎲"} {status.myBet.gameType.charAt(0).toUpperCase() + status.myBet.gameType.slice(1)}
              </p>
            )}
            <p className="text-xs text-slate-600">Waiting for The House to select tonight&rsquo;s player...</p>
          </div>
        )}

        {/* Casino not active */}
        {!status.casinoActive && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 text-center">
            <p className="text-slate-400 text-sm">Casino Night is not currently active.</p>
          </div>
        )}

        {/* Past results */}
        {status.completedBets.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Past Shows</p>
            {status.completedBets.map((b) => (
              <div key={b.id} className={`rounded-xl border p-3 ${
                b.outcome === "win" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{b.username}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.outcome === "win" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  }`}>
                    {b.outcome === "win" ? `WON ${formatPoints(b.payout)}` : "LOST"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{formatPoints(b.stake)} pts at ×{b.multiplier}</p>
              </div>
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">How It Works</p>
          <div className="text-sm text-slate-400 space-y-1">
            <p>1. Stake your points. They&rsquo;re escrowed immediately.</p>
            <p>2. The House selects ONE player for tonight&rsquo;s live show.</p>
            <p>3. All other submissions are refunded in full.</p>
            <p>4. The selected player plays the game live on stage.</p>
            <p>5. Win = ×3 payout. Go all-in = ×5 payout.</p>
          </div>
        </div>
      </div>

      <Navbar />
    </div>
  );
}
