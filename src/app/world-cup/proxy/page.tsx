"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

type Team = { id: number; name: string; code: string; flag: string; confederation: string };

const CONFEDERATIONS = ["CONCACAF", "CONMEBOL", "UEFA", "CAF", "AFC", "OFC"];

export default function ProxyPage() {
  const router = useRouter();
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [proxyTeam, setProxyTeam] = useState<Team | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [proxyCost, setProxyCost] = useState(250);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userPoints, setUserPoints] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/world-cup/proxy")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d || !d.eliminated) { router.push("/world-cup"); return; }
        setMyTeam(d.myTeam);
        setProxyTeam(d.proxyTeam);
        setAvailableTeams(d.availableTeams);
        setProxyCost(d.proxyCost ?? 250);
        if (d.proxyTeam) setSelectedId(d.proxyTeam.id);
      });
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((u) => { if (u) setUserPoints(u.points); });
  }, [router]);

  const save = async () => {
    if (!selectedId) return;
    setLoading(true); setError("");
    const res = await fetch("/api/world-cup/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selectedId }),
    });
    setLoading(false);
    if (res.ok) { router.push("/world-cup"); }
    else { const d = await res.json(); setError(d.error ?? "Something went wrong"); }
  };

  if (!myTeam) return null;

  const filteredTeams = filter === "ALL" ? availableTeams : availableTeams.filter((t) => t.confederation === filter);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-white">Pick a Proxy Team</h1>
          <p className="text-xs text-slate-500">Follow a surviving team · still earn from parlays</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Eliminated notice */}
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-center space-y-1">
          <p className="text-3xl">{myTeam.flag}</p>
          <p className="text-white font-bold">{myTeam.name} was eliminated</p>
          <p className="text-xs text-rose-400">Confidence wagers are no longer available. Pick a proxy team to keep doing parlays.</p>
          {proxyCost > 0 ? (
            <p className="text-xs text-amber-400 font-semibold">{proxyCost} pts · one-time fee · goes into the allegiance pool{userPoints !== null ? ` · you have ${userPoints.toLocaleString()} pts` : ""}</p>
          ) : (
            <p className="text-xs text-emerald-400 font-semibold">Already paid · change your proxy for free</p>
          )}
        </div>

        {proxyTeam && selectedId !== proxyTeam.id && (
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 px-4 py-2 text-center text-xs text-violet-300">
            Current proxy: {proxyTeam.flag} {proxyTeam.name}
          </div>
        )}

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
          {filteredTeams.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-xl border px-3 py-3 flex items-center gap-3 transition-all text-left ${
                selectedId === t.id
                  ? "bg-violet-500/20 border-violet-500/50 ring-1 ring-violet-400"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <span className="text-2xl">{t.flag}</span>
              <div>
                <p className="text-sm font-medium text-white leading-tight">{t.name}</p>
                <p className="text-xs text-slate-500">{t.confederation}</p>
              </div>
            </button>
          ))}
        </div>

        {filteredTeams.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-6">No teams available in this confederation.</p>
        )}

        {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

        <button
          onClick={save}
          disabled={!selectedId || loading || (proxyCost > 0 && userPoints !== null && userPoints < proxyCost)}
          className="btn-primary w-full"
        >
          {loading ? "Saving..." : selectedId
            ? proxyCost > 0
              ? `Back ${availableTeams.find((t) => t.id === selectedId)?.name ?? "..."} as proxy — ${proxyCost} pts`
              : `Switch proxy to ${availableTeams.find((t) => t.id === selectedId)?.name ?? "..."}`
            : "Select a team"}
        </button>
        {proxyCost > 0 && userPoints !== null && userPoints < proxyCost && (
          <p className="text-xs text-rose-400 text-center">You need at least {proxyCost} pts to pick a proxy.</p>
        )}
      </div>
      <Navbar />
    </div>
  );
}
