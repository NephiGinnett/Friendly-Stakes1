"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Team = { id: number; name: string; code: string; flag: string; confederation: string };
type Entry = { teamId: number; team: Team; createdAt: string };
type WCStatus = {
  visibility: "hidden" | "preview" | "visible";
  adminLiveAt: string | null;
  playerLiveAt: string | null;
  eventEndAt: string | null;
  teams: Team[];
  takenTeamIds: number[];
  entry: Entry | null;
  monitorCans: number;
  preEntryTeamId: number | null;
};

const CONFEDERATIONS = ["CONCACAF", "CONMEBOL", "UEFA", "CAF", "AFC", "OFC"];

export default function WorldCupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<WCStatus | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/world-cup")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setStatus(data);
        if (data?.preEntryTeamId) setSelectedTeamId(data.preEntryTeamId);
      });
  }, [router]);

  const enter = async () => {
    if (!selectedTeamId) { setError("Pick a team first"); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/world-cup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selectedTeamId }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) {
      const refreshed = await fetch("/api/world-cup").then((r) => r.json());
      setStatus(refreshed);
    } else {
      setError(d.error ?? "Something went wrong");
    }
  };

  if (!user || !status) return null;

  // Hidden from players
  if (status.visibility === "hidden") {
    return (
      <div className="min-h-screen pb-20 flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-4xl">⚽</p>
        <p className="text-white font-bold text-lg">Coming Soon</p>
        <p className="text-slate-500 text-sm">
          {status.playerLiveAt ? `Opens ${new Date(status.playerLiveAt).toLocaleDateString()}` : "Date TBD"}
        </p>
        <Link href="/world-cup/teaser" className="mt-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
          Fill out your bracket →
        </Link>
        <Navbar />
      </div>
    );
  }

  // Admin preview window
  if (status.visibility === "preview" && !user.isAdmin) {
    return (
      <div className="min-h-screen pb-20 flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-4xl">⚽</p>
        <p className="text-white font-bold text-lg">Opening Soon</p>
        <p className="text-slate-500 text-sm">
          {status.playerLiveAt ? `Kicks off ${new Date(status.playerLiveAt).toLocaleDateString()}` : ""}
        </p>
        <Link href="/world-cup/teaser" className="mt-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
          Fill out your bracket →
        </Link>
        <Navbar />
      </div>
    );
  }

  // Already entered — show menu
  if (status.entry) {
    const { team } = status.entry;
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">⚽ World Cup 2026</h1>
              <p className="text-xs text-slate-500">FIFA World Cup · June 11 — July 19</p>
            </div>
            <PointsBadge points={user.points} />
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
          {/* My team card */}
          <div className="card bg-emerald-500/10 border-emerald-500/30 text-center space-y-1">
            <p className="text-3xl">{team.flag}</p>
            <p className="text-white font-bold text-lg">{team.name}</p>
            <p className="text-xs text-emerald-400 font-mono uppercase tracking-widest">{team.confederation} · Your allegiance</p>
          </div>

          {/* Allegiance pool note */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-slate-400 text-center">
            Your 500 pts are in the allegiance pool. All entries split equally to players backing the World Cup champion.
          </div>

          {/* Bracket */}
          <Link href="/world-cup/bracket" className="card flex items-center gap-4 hover:border-amber-500/40 transition-colors bg-amber-500/5 border-amber-500/20">
            <span className="text-3xl">🏆</span>
            <div>
              <p className="font-semibold text-white">Build-a-Bracket</p>
              <p className="text-xs text-slate-500">Predict the full knockout bracket · earn up to 875 pts</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          {/* Nav cards */}
          <Link href="/world-cup/team" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
            <span className="text-3xl">📊</span>
            <div>
              <p className="font-semibold text-white">View Team Record</p>
              <p className="text-xs text-slate-500">Results, group standing, and upcoming fixtures</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          <Link href="/world-cup/confidence" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
            <span className="text-3xl">🤝</span>
            <div>
              <p className="font-semibold text-white">Confidence Wager</p>
              <p className="text-xs text-slate-500">Head-to-head bets with players backing the opposing team</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          <Link href="/world-cup/parlay" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
            <span className="text-3xl">🎰</span>
            <div>
              <p className="font-semibold text-white">Parlay</p>
              <p className="text-xs text-slate-500">Chain up to 5 predictions · ×2 to ×13 payout · earn 🥤 MONITOR</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          <Link href="/world-cup/fan-competition" className="card flex items-center gap-4 hover:border-amber-500/40 transition-colors">
            <span className="text-3xl">🏅</span>
            <div>
              <p className="font-semibold text-white">Fan Competition</p>
              <p className="text-xs text-slate-500">Earn fan score · top 2 split the prize pot</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          <Link href="/world-cup/shop" className="card flex items-center gap-4 hover:border-amber-500/40 transition-colors">
            <span className="text-3xl">🥤</span>
            <div>
              <p className="font-semibold text-white">Event Shop</p>
              <p className="text-xs text-slate-500">Spend Monitor Cans · {status.monitorCans} cans</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          {/* Mini Games */}
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest pt-1">Mini Games · earn Monitor Cans daily</p>

          <Link href="/world-cup/shootout" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
            <span className="text-3xl">⚽</span>
            <div>
              <p className="font-semibold text-white">Penalty Shootout</p>
              <p className="text-xs text-slate-500">Pick 5 zones · beat The House · earn up to 3 🥤</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          <Link href="/world-cup/reflex" className="card flex items-center gap-4 hover:border-violet-500/40 transition-colors">
            <span className="text-3xl">🧤</span>
            <div>
              <p className="font-semibold text-white">Keeper&apos;s Reflex</p>
              <p className="text-xs text-slate-500">Face a real player&apos;s kicks · earn up to 3 🥤</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          <Link href="/world-cup/standings" className="card flex items-center gap-4 hover:border-slate-500/40 transition-colors">
            <span className="text-3xl">📊</span>
            <div>
              <p className="font-semibold text-white">Mini Game Standings</p>
              <p className="text-xs text-slate-500">Shootout scores · Keeper save rates</p>
            </div>
            <span className="ml-auto text-slate-600">›</span>
          </Link>

          {status.visibility === "preview" && user.isAdmin && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-xs text-amber-400 text-center">
              ⚙️ Admin preview — players can&apos;t see this yet
            </div>
          )}
        </div>
        <Navbar />
      </div>
    );
  }

  // Entry gate — pay 500 pts, pick a team
  const filteredTeams = filter === "ALL" ? status.teams : status.teams.filter((t) => t.confederation === filter);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">⚽ World Cup 2026</h1>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-0 space-y-4">

        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        {/* Replace /world-cup/hero.jpg with a ~800×360px stadium/trophy image */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950 via-[#0a1a0f] to-[#0f0f16] border border-emerald-900/40"
          style={{ minHeight: 180 }}>
          {/* Placeholder — swap out once you have art */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="flex gap-3 text-5xl">🇺🇸⚽🏆</div>
            <h2 className="text-white font-black text-2xl tracking-tight leading-tight">
              FIFA World Cup<br />
              <span className="text-emerald-400">2026</span>
            </h2>
            <p className="text-emerald-700 text-xs font-mono tracking-widest uppercase">June 11 — July 19 · USA, Canada, Mexico</p>
          </div>
          {/* Decorative pitch lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 400 180" fill="none">
            <circle cx="200" cy="90" r="50" stroke="white" strokeWidth="2"/>
            <line x1="200" y1="0" x2="200" y2="180" stroke="white" strokeWidth="2"/>
            <rect x="0" y="30" width="60" height="120" stroke="white" strokeWidth="2"/>
            <rect x="340" y="30" width="60" height="120" stroke="white" strokeWidth="2"/>
          </svg>
        </div>

        {/* ── Event explainer ──────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">How it works</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "🏳️", label: "Back a Team", desc: "Pay 500 pts. Pick one of 48 nations as your allegiance." },
              { icon: "🏆", label: "Build Bracket", desc: "Predict every knockout round. Earn up to 875 pts." },
              { icon: "🤝", label: "Confidence Bets", desc: "Head-to-head wagers against players backing the opposite team." },
              { icon: "🎰", label: "Parlays", desc: "Chain up to 5 match predictions for ×2–×13 payouts." },
              { icon: "⚽", label: "Mini Games", desc: "Penalty Shootout & Keeper Reflex — earn Monitor Cans daily." },
              { icon: "🥤", label: "Event Shop", desc: "Spend Monitor Cans on bonuses, items, and rewards." },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{icon}</span>
                  <span className="text-white text-xs font-semibold">{label}</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Prize pool ───────────────────────────────────────────────────── */}
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="text-amber-300 font-bold text-sm">Allegiance Pool</p>
            <p className="text-slate-400 text-xs">Every 500 pt entry goes in the pot. Players who backed the champion split it equally.</p>
          </div>
        </div>

        {/* ── Entry gate ───────────────────────────────────────────────────── */}
        <div className="card border-emerald-500/30 bg-emerald-500/5 space-y-1 text-center">
          <p className="font-bold text-white">Pick Your Nation</p>
          <p className="text-sm text-slate-400">
            <span className="text-emerald-300 font-bold">500 pts</span> · one team per player · first come, first served
          </p>
          <p className="text-xs text-slate-500">You have {formatPoints(user.points)} pts</p>
        </div>

        {/* Confederation filter */}
        <div className="flex gap-1.5 flex-wrap">
          {["ALL", ...CONFEDERATIONS].map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                filter === c ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Team grid */}
        <div className="grid grid-cols-2 gap-2">
          {filteredTeams.map((t) => {
            const isTaken = status.takenTeamIds.includes(t.id);
            const isSelected = selectedTeamId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => !isTaken && setSelectedTeamId(t.id)}
                disabled={isTaken}
                className={`rounded-xl border px-3 py-3 flex items-center gap-3 transition-all text-left ${
                  isTaken
                    ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                    : isSelected
                    ? "bg-violet-500/20 border-violet-500/50 ring-1 ring-violet-400"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <span className="text-2xl">{t.flag}</span>
                <div>
                  <p className="text-sm font-medium text-white leading-tight">{t.name}</p>
                  <p className="text-xs text-slate-500">{isTaken ? "Taken" : t.confederation}</p>
                </div>
              </button>
            );
          })}
        </div>

        {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

        <button
          onClick={enter}
          disabled={!selectedTeamId || loading || user.points < 500}
          className="btn-primary w-full"
        >
          {loading ? "Entering..." : selectedTeamId ? `Back ${status.teams.find((t) => t.id === selectedTeamId)?.name} — 500 pts` : "Select a team to enter"}
        </button>

        {user.points < 500 && (
          <p className="text-xs text-rose-400 text-center">You need at least 500 pts to enter.</p>
        )}
      </div>
      <Navbar />
    </div>
  );
}
