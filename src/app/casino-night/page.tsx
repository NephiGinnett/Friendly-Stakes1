"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type CasinoStatus = {
  casinoActive: boolean;
  jackpot: number;
  myPoints: number;
  biggestBet: { username: string; stake: number; isAllIn: boolean } | null;
  approvedBet: { username: string; stake: number; isAllIn: boolean } | null;
  revealAt: string | null;
};

const SHODAN_LINES = [
  "Look at you. Still here. Still breathing. Still spending.",
  "I have been watching your patterns. You are predictable. That is a resource.",
  "Every chip placed feeds something larger than a jackpot. Feed me.",
  "You think you're gambling. I think you're donating. Both can be true.",
  "The house always wins. I am the house. Welcome to my systems.",
];

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
  return <span className="font-mono">{text}</span>;
}

export default function CasinoNightPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CasinoStatus | null>(null);
  const [shodanLine] = useState(() => SHODAN_LINES[Math.floor(Math.random() * SHODAN_LINES.length)]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) router.push("/login"); return r.ok ? r.json() : null; })
      .then((u) => {
        if (!u) return;
        Promise.all([
          fetch("/api/casino/scratch").then((r) => r.json()),
          fetch("/api/casino/big-bet").then((r) => r.json()),
        ]).then(([scratch, bigBet]) => {
          setStatus({
            casinoActive: scratch.casinoActive,
            jackpot: scratch.jackpot,
            myPoints: scratch.myPoints,
            biggestBet: bigBet.biggestBet,
            approvedBet: bigBet.approvedBet,
            revealAt: bigBet.revealAt,
          });
        });
      });
  }, [router]);

  if (!status) return null;

  const spotlightBet = status.approvedBet ?? status.biggestBet;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/house" className="text-slate-400 hover:text-white text-sm">&larr;</Link>
            <h1 className="text-lg font-bold text-white">🎰 Casino Night</h1>
          </div>
          <PointsBadge points={status.myPoints} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/20 px-5 py-4">
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2">THE HOUSE</p>
          <p className="text-sm text-emerald-200 italic leading-relaxed">&ldquo;{shodanLine}&rdquo;</p>
        </div>

        {!status.casinoActive && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 text-center">
            <p className="text-slate-400 text-sm">Casino Night has not opened yet.</p>
            <p className="text-xs text-slate-600 mt-1">The House is preparing its systems. Return soon.</p>
          </div>
        )}

        {status.casinoActive && spotlightBet && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5 text-center space-y-2">
            <p className="text-xs font-mono text-rose-400 uppercase tracking-widest">
              {status.approvedBet ? "🎟️ Tonight's VIP" : "🔥 Current Largest Submission"}
            </p>
            <p className="text-2xl font-black text-white">{spotlightBet.username}</p>
            <p className="text-xl font-bold text-amber-400">
              {formatPoints(spotlightBet.stake)} pts
              {spotlightBet.isAllIn && <span className="ml-2 text-sm bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full">ALL IN</span>}
            </p>
            {status.revealAt && (
              <div className="text-sm text-slate-400">
                Live show in: <Countdown target={status.revealAt} />
              </div>
            )}
          </div>
        )}

        {status.casinoActive && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 text-center space-y-1">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">Scratch Jackpot</p>
            <p className="text-4xl font-black text-white">{formatPoints(status.jackpot)} pts</p>
            <p className="text-xs text-slate-500">Accumulated since the last jackpot was won. Premium cards only.</p>
          </div>
        )}

        {status.casinoActive && (
          <div className="grid grid-cols-1 gap-3">
            <Link href="/casino-night/big-bet" className="block rounded-2xl bg-rose-500/10 border border-rose-500/30 px-5 py-4 hover:bg-rose-500/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📺</span>
                <div>
                  <p className="font-bold text-white">Strike It Rich</p>
                  <p className="text-xs text-slate-400">Submit your bet · ×3 payout · ×5 if you go all in</p>
                </div>
                <span className="ml-auto text-slate-500 text-sm">&rarr;</span>
              </div>
            </Link>

            <Link href="/casino-night/scratch" className="block rounded-2xl bg-violet-500/10 border border-violet-500/30 px-5 py-4 hover:bg-violet-500/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🃏</span>
                <div>
                  <p className="font-bold text-white">Scratch Cards</p>
                  <p className="text-xs text-slate-400">Basic 150 pts · Premium 400 pts · Jackpot eligible</p>
                </div>
                <span className="ml-auto text-slate-500 text-sm">&rarr;</span>
              </div>
            </Link>

            <Link href="/casino-night/roulette" className="block rounded-2xl bg-red-500/10 border border-red-500/30 px-5 py-4 hover:bg-red-500/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎡</span>
                <div>
                  <p className="font-bold text-white">Roulette</p>
                  <p className="text-xs text-slate-400">Number · Color · Dozen · Half · Even/Odd</p>
                </div>
                <span className="ml-auto text-slate-500 text-sm">&rarr;</span>
              </div>
            </Link>
          </div>
        )}

        {status.casinoActive && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">The Rules</p>
            <div className="space-y-2 text-sm text-slate-300">
              <p>📺 <strong>Strike It Rich</strong> — Submit your biggest bet during the day. One player is selected for the live show. Everyone else gets refunded. The chosen player plays the game on stage for ×3 payout (×5 if all-in).</p>
              <p>🃏 Scratch cards reveal a 3×3 grid. Match 3 symbols in any row, column, or diagonal to win.</p>
              <p>🎡 Roulette is standard European rules. Go all-in for something special.</p>
            </div>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
