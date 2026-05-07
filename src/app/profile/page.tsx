"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints, formatDate } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type WagerEntry = { userId: number; side: string; stake: number };
type Wager = {
  id: number; title: string; creatorStake: number; status: string;
  winnerSide: string | null; createdAt: string;
  creator: { id: number; username: string };
  entries: WagerEntry[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wagers, setWagers] = useState<Wager[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/wagers")
      .then((r) => r.json())
      .then(setWagers);
  }, [router]);

  if (!user) return null;

  const myWagers = wagers.filter(
    (w) => w.creator.id === user.id || w.entries.some((e) => e.userId === user.id)
  );

  const getUserSide = (w: Wager) => {
    if (w.creator.id === user.id) return "for";
    return w.entries.find((e) => e.userId === user.id)?.side ?? null;
  };

  const wins = myWagers.filter(
    (w) => w.status === "settled" && w.winnerSide === getUserSide(w)
  ).length;
  const losses = myWagers.filter(
    (w) => w.status === "settled" && w.winnerSide !== null && w.winnerSide !== getUserSide(w)
  ).length;
  const active = myWagers.filter((w) =>
    ["open", "started", "voting"].includes(w.status)
  ).length;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-white">Profile</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        <div className="card text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-violet-600/30 flex items-center justify-center text-2xl font-bold text-violet-300 mx-auto">
            {user.username[0].toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-white">{user.username}</h2>
          <PointsBadge points={user.points} />
          {user.isAdmin && (
            <span className="inline-block bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">Admin</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-emerald-400">{wins}</p>
            <p className="text-xs text-slate-500">Wins</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-rose-400">{losses}</p>
            <p className="text-xs text-slate-500">Losses</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-sky-400">{active}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-3">Your Wagers</h3>
          {myWagers.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No wagers yet</p>
          ) : (
            <div className="space-y-2">
              {myWagers.map((w) => {
                const side = getUserSide(w);
                const won = w.status === "settled" && w.winnerSide === side;
                const lost = w.status === "settled" && w.winnerSide !== null && w.winnerSide !== side;
                const pool =
                  w.creatorStake +
                  w.entries.reduce((sum, e) => sum + e.stake, 0);
                return (
                  <button
                    key={w.id}
                    onClick={() => router.push(`/wagers/${w.id}`)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white truncate">{w.title}</p>
                      {won && <span className="text-xs text-emerald-400 font-medium">Won +{formatPoints(pool)}</span>}
                      {lost && <span className="text-xs text-rose-400 font-medium">Lost</span>}
                      {!won && !lost && <span className="text-xs text-slate-500">{w.status}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(w.createdAt)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Navbar />
    </div>
  );
}
