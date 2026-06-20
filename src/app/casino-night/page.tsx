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

const GAMES = [
  { href: "/house?tab=wheel", emoji: "🎡", name: "The Wheel", desc: "Spin for prizes, points, or pain", color: "violet" },
  { href: "/casino-night/scratch", emoji: "🃏", name: "Scratch Cards", desc: "Basic 150 · Premium 400 · Jackpot", color: "violet" },
  { href: "/casino-night/slots", emoji: "🎰", name: "Slots", desc: "Triple match for massive payouts", color: "emerald" },
  { href: "/house?tab=blackjack", emoji: "🃏", name: "Blackjack", desc: "Beat the dealer · 1.5× on win", color: "amber" },
  { href: "/casino-night/roulette", emoji: "🎡", name: "Roulette", desc: "Number · Color · Dozen · Half", color: "red" },
] as const;

const COLOR_MAP: Record<string, string> = {
  violet: "bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20",
  emerald: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20",
  amber: "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20",
  red: "bg-red-500/10 border-red-500/30 hover:bg-red-500/20",
};

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

        {status.casinoActive && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 text-center space-y-1">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">Scratch Jackpot</p>
            <p className="text-4xl font-black text-white">{formatPoints(status.jackpot)} pts</p>
            <p className="text-xs text-slate-500">Premium cards only.</p>
          </div>
        )}

        {/* 5 Game Panels */}
        {status.casinoActive && (
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((g) => (
              <Link key={g.href} href={g.href}
                className={`block rounded-2xl border px-4 py-4 transition-colors ${COLOR_MAP[g.color]}`}>
                <span className="text-2xl">{g.emoji}</span>
                <p className="font-bold text-white text-sm mt-1">{g.name}</p>
                <p className="text-[11px] text-slate-400 leading-tight">{g.desc}</p>
              </Link>
            ))}
          </div>
        )}

        {/* Strike It Rich — center bottom */}
        {status.casinoActive && (
          <Link href="/casino-night/big-bet" className="block rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 px-5 py-5 hover:bg-rose-500/20 transition-colors">
            <div className="text-center space-y-2">
              <p className="text-3xl">📺</p>
              <p className="text-lg font-black text-white">Strike It Rich</p>
              <p className="text-xs text-slate-400">Submit your biggest bet · ×3 payout · ×5 if you go all in</p>
              {spotlightBet && (
                <div className="mt-2 pt-2 border-t border-rose-500/20">
                  <p className="text-xs font-mono text-rose-400 uppercase tracking-widest">
                    {status.approvedBet ? "🎟️ Tonight's VIP" : "🔥 Current Leader"}
                  </p>
                  <p className="text-base font-black text-white">{spotlightBet.username}</p>
                  <p className="text-sm font-bold text-amber-400">
                    {formatPoints(spotlightBet.stake)} pts
                    {spotlightBet.isAllIn && <span className="ml-2 text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full">ALL IN</span>}
                  </p>
                  {status.revealAt && (
                    <p className="text-xs text-slate-400 mt-1">
                      Live show in: <Countdown target={status.revealAt} />
                    </p>
                  )}
                </div>
              )}
            </div>
          </Link>
        )}

        {/* Rules */}
        {status.casinoActive && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">The Rules</p>
            <div className="space-y-2 text-sm text-slate-300">
              <p>📺 <strong>Strike It Rich</strong> — Submit your biggest bet. One player is selected for the live show. Everyone else gets refunded. ×3 payout (×5 if all-in).</p>
              <p>🃏 Scratch cards reveal a 3×3 grid. Match 3 in any line to win.</p>
              <p>🎰 Slots — triple match for multiplied payout, double returns your bet.</p>
              <p>🎡 Roulette — standard European rules. Go all-in for something special.</p>
              <p>🃏 Blackjack &amp; The Wheel are on the House floor.</p>
            </div>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
