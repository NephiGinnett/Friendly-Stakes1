"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { GAME_REGISTRY } from "@/lib/gameRegistry";

type Row = {
  rank: number;
  userId: number;
  username: string;
  bestMetric: number;
  totalPts: number;
  runs: number;
  isMe: boolean;
};

type LeaderboardData = {
  rows: Row[];
  game: { leaderboardLabel: string; leaderboardUnit: string };
};

function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-lg leading-none">🥇</span>;
  if (rank === 2) return <span className="text-lg leading-none">🥈</span>;
  if (rank === 3) return <span className="text-lg leading-none">🥉</span>;
  return <span className="text-slate-500 text-sm font-mono">#{rank}</span>;
}

function fmt(n: number, unit: string) {
  if (unit === "m" && n >= 1000) return `${(n / 1000).toFixed(1)}km`;
  if (unit === "$") return `$${n.toLocaleString()}`;
  return `${n.toLocaleString()}${unit}`;
}


export default function LeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const game = GAME_REGISTRY[slug as keyof typeof GAME_REGISTRY];

  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) { router.push("/login"); return; }
      if (!game) { router.push("/games"); return; }
      fetch(`/api/games/leaderboard?gameId=${slug}`)
        .then((r) => r.json())
        .then((d) => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    });
  }, [router, game, slug]);

  if (!game) return null;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/games/${slug}`} className="text-slate-400 hover:text-white text-sm transition-colors">←</Link>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              {game.emoji} {game.name} — Leaderboard
            </h1>
            <p className="text-slate-500 text-xs">All-time best · {data?.game.leaderboardLabel ?? "Score"}</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5">
        {loading && (
          <div className="text-center text-slate-500 py-12">Loading…</div>
        )}

        {!loading && data && data.rows.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <div className="text-4xl">{game.emoji}</div>
            <p className="text-slate-400">No scores recorded yet.</p>
            <p className="text-slate-600 text-sm">Be the first to make it to the leaderboard!</p>
            <Link href={`/games/${slug}`} className="inline-block mt-3 text-violet-400 text-sm hover:text-violet-300">
              Play now →
            </Link>
          </div>
        )}

        {!loading && data && data.rows.length > 0 && (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 px-4 pb-1 text-xs text-slate-600 font-medium">
              <span></span>
              <span>Player</span>
              <span className="text-right">{data.game.leaderboardLabel}</span>
              <span className="text-right w-14">Pts</span>
            </div>

            {data.rows.map((row) => (
              <div
                key={row.userId}
                className={`grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 items-center px-4 py-3 rounded-xl border transition-colors ${
                  row.isMe
                    ? "bg-violet-500/10 border-violet-500/30"
                    : "bg-white/5 border-white/8"
                }`}
              >
                <div className="flex justify-center">{rankBadge(row.rank)}</div>
                <div>
                  <span className={`font-medium text-sm ${row.isMe ? "text-violet-300" : "text-white"}`}>
                    {row.username}
                    {row.isMe && <span className="text-violet-500 text-xs ml-1.5">you</span>}
                  </span>
                  <div className="text-slate-600 text-xs mt-0.5">{row.runs} run{row.runs !== 1 ? "s" : ""}</div>
                </div>
                <div className={`text-right font-mono font-semibold text-sm ${row.rank === 1 ? "text-yellow-400" : "text-slate-300"}`}>
                  {fmt(row.bestMetric, data.game.leaderboardUnit)}
                </div>
                <div className="text-right text-slate-500 text-xs w-14">
                  {row.totalPts} pts
                </div>
              </div>
            ))}

            <p className="text-center text-slate-700 text-xs pt-3">
              Top 50 · ranked by {data.game.leaderboardLabel.toLowerCase()}
            </p>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
