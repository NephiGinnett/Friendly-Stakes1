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

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        {(Object.values(GAME_REGISTRY) as GameEntry[]).map((game) => (
          <div key={game.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <Link
              href={`/games/${game.id}`}
              className="block hover:bg-white/5 transition-colors p-5"
            >
              <div className="flex items-start gap-4">
                <span className="text-4xl leading-none">{game.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-base">{game.name}</div>
                  <div className="text-slate-400 text-sm mt-1 leading-snug">{game.description}</div>
                  <div className="flex gap-3 mt-2.5 text-xs text-slate-500">
                    <span>Up to {game.dailyCap} pts/day</span>
                    <span>·</span>
                    <span>{game.conversionRate} coins = 1 pt</span>
                  </div>
                </div>
                <span className="text-slate-600 text-xl self-center">›</span>
              </div>
            </Link>
            <div className="border-t border-white/8 px-5 py-2.5">
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
