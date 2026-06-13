"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type LeaderboardEntry = {
  rank: number;
  userId: number;
  username: string;
  teamName: string;
  teamFlag: string;
  fanScore: number;
};

type FanStatus = {
  pot: number;
  myScore: number;
  myRank: number | null;
  myPoints: number;
  hasEntry: boolean;
  leaderboard: LeaderboardEntry[];
};

export default function FanCompetitionPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [status, setStatus] = useState<FanStatus | null>(null);
  const [donateAmount, setDonateAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [error, setError] = useState("");
  const [lastGain, setLastGain] = useState<number | null>(null);

  const load = () =>
    fetch("/api/world-cup/fan-competition")
      .then((r) => r.ok ? r.json() : null)
      .then(setStatus);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then((u) => { if (u) setUserId(u.id); });
    load();
  }, [router]);

  const donate = async () => {
    const amt = parseInt(donateAmount);
    if (!amt || amt < 1) { setError("Enter a valid amount"); return; }
    setDonating(true); setError(""); setLastGain(null);
    const res = await fetch("/api/world-cup/fan-competition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt }),
    });
    const d = await res.json();
    setDonating(false);
    if (res.ok) {
      setLastGain(d.scoreGain);
      setDonateAmount("");
      load();
    } else {
      setError(d.error ?? "Something went wrong");
    }
  };

  if (!status) return null;

  const { pot, myScore, myRank, myPoints, leaderboard, hasEntry } = status;
  const donateNum = parseInt(donateAmount) || 0;
  const previewScore = Math.floor(donateNum * 0.5);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <h1 className="text-lg font-bold text-white">🏅 Fan Competition</h1>
          </div>
          <PointsBadge points={myPoints} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Prize pot */}
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 text-center space-y-2">
          <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">Prize Pot</p>
          <p className="text-4xl font-black text-white">{formatPoints(pot)} pts</p>
          <div className="flex justify-center gap-6 pt-1">
            <div className="text-center">
              <p className="text-sm font-bold text-amber-300">1st place</p>
              <p className="text-xs text-slate-400">{formatPoints(Math.floor(pot * 0.65))} pts</p>
            </div>
            <div className="text-slate-700 self-center">·</div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-300">2nd place</p>
              <p className="text-xs text-slate-400">{formatPoints(pot - Math.floor(pot * 0.65))} pts</p>
            </div>
          </div>
        </div>

        {/* How fan score is earned */}
        <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">How you earn fan score</p>
          <div className="space-y-1.5 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>🤝 Confidence wager net profit</span>
              <span className="text-emerald-400 font-mono">×1.0</span>
            </div>
            <div className="flex justify-between">
              <span>🎰 Parlay net profit</span>
              <span className="text-emerald-400 font-mono">×1.0</span>
            </div>
            <div className="flex justify-between">
              <span>💰 Direct point donation</span>
              <span className="text-amber-400 font-mono">×0.5</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 pt-1">10% of activity net profits are skimmed into the pot automatically.</p>
        </div>

        {/* My score */}
        {hasEntry && (
          <div className="rounded-2xl bg-violet-500/10 border border-violet-500/30 px-4 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-violet-400 uppercase tracking-widest">Your fan score</p>
              <p className="text-2xl font-black text-white">{formatPoints(myScore)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Rank</p>
              <p className="text-2xl font-black text-white">{myRank ? `#${myRank}` : "—"}</p>
            </div>
          </div>
        )}

        {/* Donate */}
        {hasEntry && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-white">Donate points to the pot</p>
            <p className="text-xs text-slate-500">You keep skin in the game — donations count at 50% toward your fan score.</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max={myPoints}
                value={donateAmount}
                onChange={(e) => setDonateAmount(e.target.value)}
                placeholder="Amount..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={donate}
                disabled={donating || donateNum < 1 || donateNum > myPoints}
                className="btn-primary px-4 disabled:opacity-40"
              >
                {donating ? "..." : "Donate"}
              </button>
            </div>
            {donateNum > 0 && (
              <p className="text-xs text-slate-400">
                {formatPoints(donateNum)} pts → pot grows by {formatPoints(donateNum)}, your score +{formatPoints(previewScore)}
              </p>
            )}
            {lastGain !== null && (
              <p className="text-xs text-emerald-400">+{formatPoints(lastGain)} fan score added!</p>
            )}
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        )}

        {!hasEntry && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 text-center space-y-2">
            <p className="text-slate-400 text-sm">You need to enter the World Cup event to compete.</p>
            <Link href="/world-cup" className="btn-primary inline-block">Join the event →</Link>
          </div>
        )}

        {/* Leaderboard */}
        <div className="space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Leaderboard</p>
          {leaderboard.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">No scores yet — play and donate to climb!</p>
          ) : (
            leaderboard.map((e) => {
              const isMe = e.userId === userId;
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <div
                  key={e.userId}
                  className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                    isMe
                      ? "bg-violet-500/15 border-violet-500/40"
                      : "bg-white/[0.03] border-white/8"
                  }`}
                >
                  <span className="text-lg w-7 text-center shrink-0">
                    {medals[e.rank - 1] ?? <span className="text-slate-500 font-mono text-sm">#{e.rank}</span>}
                  </span>
                  <span className="text-xl shrink-0">{e.teamFlag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{e.username}</p>
                    <p className="text-xs text-slate-500">{e.teamName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white font-mono">{formatPoints(e.fanScore)}</p>
                    <p className="text-xs text-slate-600">score</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Navbar />
    </div>
  );
}
