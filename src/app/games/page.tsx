"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import { GAME_REGISTRY } from "@/lib/gameRegistry";

type GameEntry = (typeof GAME_REGISTRY)[keyof typeof GAME_REGISTRY];

export default function GamesPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/login");
    });
  }, [router]);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-white">🎮 Games Room</h1>
          <p className="text-slate-500 text-xs mt-0.5">Play games, earn coins, convert to points</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-2">
        {(Object.values(GAME_REGISTRY) as GameEntry[]).map((game) => (
          <div key={game.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <Link
              href={`/games/${game.id}`}
              className="block hover:bg-white/5 transition-colors px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{game.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-white font-semibold text-sm">{game.name}</span>
                    <span className="text-slate-600 text-xs shrink-0">Up to {game.dailyCap} pts/day</span>
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5 leading-snug line-clamp-2">{game.description}</div>
                </div>
                <span className="text-slate-600 text-lg shrink-0">›</span>
              </div>
            </Link>
            <div className="border-t border-white/[0.06] px-4 py-2">
              <Link
                href={`/games/${game.id}/leaderboard`}
                className="text-slate-500 hover:text-violet-400 text-xs font-medium transition-colors"
              >
                📊 Leaderboard →
              </Link>
            </div>
          </div>
        ))}

        <div className="text-center text-slate-700 text-xs pt-2">
          More games coming soon
        </div>
      </div>

      <Navbar />
    </div>
  );
}
