"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

type ShootoutRow = { username: string; flag: string; plays: number; bestScore: number; totalCans: number };
type ReflexRow = { username: string; flag: string; plays: number; totalSaves: number; saveRate: number; totalCans: number };

export default function StandingsPage() {
  const router = useRouter();
  const [shootout, setShootout] = useState<ShootoutRow[]>([]);
  const [reflex, setReflex] = useState<ReflexRow[]>([]);
  const [tab, setTab] = useState<"shootout" | "reflex">("shootout");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => { if (!r.ok) router.push("/login"); });
    fetch("/api/world-cup/standings")
      .then((r) => r.ok ? r.json() : r.json().then((d: { error: string }) => { throw new Error(d.error); }))
      .then((d) => { setShootout(d.shootout); setReflex(d.reflex); setLoaded(true); })
      .catch((e) => setError(e.message));
  }, [router]);

  const RANK_COLORS = ["text-amber-300", "text-slate-300", "text-amber-700"];

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pb-20 px-4">
        <p className="text-rose-400 text-sm">{error}</p>
        <Link href="/world-cup" className="mt-4 text-violet-400 text-sm">← Back</Link>
        <Navbar />
      </div>
    );
  }

  if (!loaded) return null;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
          <h1 className="text-lg font-bold text-white">📊 Mini Game Standings</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("shootout")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "shootout" ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
          >
            ⚽ Penalty Shootout
          </button>
          <button
            onClick={() => setTab("reflex")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "reflex" ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
          >
            🧤 Keeper&apos;s Reflex
          </button>
        </div>

        {tab === "shootout" && (
          <div className="card space-y-0 divide-y divide-white/5">
            {shootout.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-6">No games played yet</p>
            )}
            {/* Header */}
            {shootout.length > 0 && (
              <div className="grid grid-cols-4 py-2 px-1 text-xs font-mono text-slate-600 uppercase">
                <span>Player</span>
                <span className="text-center">Best</span>
                <span className="text-center">Plays</span>
                <span className="text-right">🥤 Total</span>
              </div>
            )}
            {shootout.map((row, i) => (
              <div key={row.username} className="grid grid-cols-4 items-center py-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold w-4 ${RANK_COLORS[i] ?? "text-slate-500"}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm">{row.flag}</span>
                  <span className="text-sm text-white font-medium truncate">{row.username}</span>
                </div>
                <p className="text-center font-mono text-sm text-emerald-400 font-bold">{row.bestScore}/5</p>
                <p className="text-center text-xs text-slate-500">{row.plays}×</p>
                <p className="text-right text-xs text-amber-300 font-mono">{row.totalCans} 🥤</p>
              </div>
            ))}
          </div>
        )}

        {tab === "reflex" && (
          <div className="card space-y-0 divide-y divide-white/5">
            {reflex.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-6">No games played yet</p>
            )}
            {reflex.length > 0 && (
              <div className="grid grid-cols-4 py-2 px-1 text-xs font-mono text-slate-600 uppercase">
                <span>Player</span>
                <span className="text-center">Rate</span>
                <span className="text-center">Plays</span>
                <span className="text-right">🥤 Total</span>
              </div>
            )}
            {reflex.map((row, i) => (
              <div key={row.username} className="grid grid-cols-4 items-center py-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold w-4 ${RANK_COLORS[i] ?? "text-slate-500"}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm">{row.flag}</span>
                  <span className="text-sm text-white font-medium truncate">{row.username}</span>
                </div>
                <p className="text-center font-mono text-sm text-emerald-400 font-bold">{row.saveRate}%</p>
                <p className="text-center text-xs text-slate-500">{row.plays}×</p>
                <p className="text-right text-xs text-amber-300 font-mono">{row.totalCans} 🥤</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link href="/world-cup/shootout" className="card text-center hover:border-violet-500/40 transition-colors py-4">
            <p className="text-2xl mb-1">⚽</p>
            <p className="text-sm font-semibold text-white">Shootout</p>
            <p className="text-xs text-slate-500">Daily</p>
          </Link>
          <Link href="/world-cup/reflex" className="card text-center hover:border-violet-500/40 transition-colors py-4">
            <p className="text-2xl mb-1">🧤</p>
            <p className="text-sm font-semibold text-white">Keeper&apos;s Reflex</p>
            <p className="text-xs text-slate-500">Daily</p>
          </Link>
        </div>
      </div>
      <Navbar />
    </div>
  );
}
