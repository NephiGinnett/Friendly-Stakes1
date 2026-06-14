"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type BigBetEntry = {
  id: number;
  username: string;
  isMe: boolean;
  title: string;
  description: string;
  stake: number;
  multiplier: number;
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
  myPendingBet: { id: number; title: string; description: string; stake: number } | null;
  bets: BigBetEntry[];
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
    fetch("/api/casino/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "/casino-night/big-bet" }),
    });
  }, [router, load]);

  const submit = async () => {
    const amt = parseInt(stake);
    if (!title.trim() || !description.trim() || !amt) {
      setError("Fill in all fields");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/casino/big-bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), stake: amt }),
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
                  <div className={`rounded-2xl border p-5 text-center space-y-3 transition-all ${
                    currentReveal.outcome === "win"
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-rose-500/10 border-rose-500/40"
                  }`}>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                      Bet {revealIndex + 1} of {revealBets.length}
                    </p>
                    <p className="text-xl font-bold text-white">{currentReveal.username}</p>
                    <p className="text-lg text-slate-200">"{currentReveal.title}"</p>
                    <p className="text-sm text-slate-400">{currentReveal.description}</p>
                    <p className="text-sm text-slate-400">Stake: {formatPoints(currentReveal.stake)} pts</p>
                    <div className="pt-2">
                      {currentReveal.outcome === "win" ? (
                        <>
                          <p className="text-3xl font-black text-emerald-400">WIN</p>
                          <p className="text-lg text-white font-bold">+{formatPoints((currentReveal.payout ?? 0) - currentReveal.stake)} pts profit</p>
                          <p className="text-xs text-slate-500">{formatPoints(currentReveal.payout ?? 0)} pts returned</p>
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

            {/* Summary after show */}
            {!showingReveal && (
              <div className="space-y-2">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Results</p>
                {revealBets.map((b) => (
                  <div key={b.id} className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                    b.outcome === "win" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
                  }`}>
                    <div>
                      <p className="text-sm font-semibold text-white">{b.username}</p>
                      <p className="text-xs text-slate-400">{b.title}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${b.outcome === "win" ? "text-emerald-400" : "text-rose-400"}`}>
                        {b.outcome === "win" ? `+${formatPoints((b.payout ?? 0) - b.stake)}` : `-${formatPoints(b.stake)}`}
                      </p>
                      <p className="text-xs text-slate-600">{b.outcome}</p>
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
                <p className="text-xs text-slate-600">Submit before then. Once The House resolves, it waits for no one.</p>
              </div>
            )}

            {myPendingBet ? (
              <div className="rounded-2xl bg-violet-500/10 border border-violet-500/30 px-4 py-4 space-y-2">
                <p className="text-xs font-mono text-violet-400 uppercase tracking-widest">Your Submission</p>
                <p className="text-sm font-bold text-white">{myPendingBet.title}</p>
                <p className="text-xs text-slate-400">{myPendingBet.description}</p>
                <p className="text-xs text-slate-500">{formatPoints(myPendingBet.stake)} pts escrowed · 1.5× if you win</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-3">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Submit a Bet</p>
                <p className="text-xs text-slate-500">
                  Describe something you predict will happen. The House resolves it. If you win, you get 1.5× your stake back.
                </p>
                <input
                  type="text"
                  placeholder="Title (e.g. 'I will finish a puzzle in under 10 minutes')"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
                />
                <textarea
                  placeholder="Describe the bet in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50 resize-none"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="50"
                    max={myPoints}
                    placeholder="Stake (min 50)"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  />
                  <button
                    onClick={submit}
                    disabled={submitting || !title.trim() || !description.trim() || !parseInt(stake)}
                    className="btn-primary px-4 disabled:opacity-40"
                  >
                    {submitting ? "..." : "Submit"}
                  </button>
                </div>
                {parseInt(stake) > 0 && (
                  <p className="text-xs text-slate-400">
                    Win: +{formatPoints(Math.floor(parseInt(stake) * 0.5))} pts profit ({formatPoints(Math.floor(parseInt(stake) * 1.5))} returned)
                  </p>
                )}
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
                        <p className="text-sm font-semibold text-white">{b.username} {b.isMe && <span className="text-violet-400 text-xs">(you)</span>}</p>
                        <p className="text-xs text-slate-300 mt-0.5">"{b.title}"</p>
                        <p className="text-xs text-slate-500 mt-0.5">{b.description}</p>
                      </div>
                      <p className="text-xs text-slate-400 font-mono shrink-0">{formatPoints(b.stake)} pts</p>
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
