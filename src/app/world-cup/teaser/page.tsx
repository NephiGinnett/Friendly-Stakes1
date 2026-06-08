"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";

type Team = { id: number; name: string; code: string; flag: string; confederation: string };
type TeaserStatus = {
  isLive: boolean;
  hasRealEntry: boolean;
  playerLiveAt: string | null;
  teams: Team[];
  takenTeamIds: number[];
  preEntry: { teamId: number | null; championPickId: number | null; runnerUpPickId: number | null } | null;
};
type User = { id: number; username: string; points: number; isAdmin: boolean };

const CONFEDERATIONS = ["CONCACAF", "CONMEBOL", "UEFA", "CAF", "AFC", "OFC"];

function TeamGrid({
  teams,
  selected,
  takenIds,
  exclude,
  onSelect,
}: {
  teams: Team[];
  selected: number | null;
  takenIds: number[];
  exclude?: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [filter, setFilter] = useState("ALL");
  const visible = filter === "ALL" ? teams : teams.filter((t) => t.confederation === filter);

  return (
    <div className="space-y-3">
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
      <div className="grid grid-cols-2 gap-2">
        {visible.map((t) => {
          const isTaken = takenIds.includes(t.id) && t.id !== selected;
          const isExcluded = exclude === t.id;
          const isSelected = selected === t.id;
          const disabled = isTaken || isExcluded;
          return (
            <button
              key={t.id}
              onClick={() => !disabled && onSelect(isSelected ? null : t.id)}
              disabled={disabled}
              className={`rounded-xl border px-3 py-3 flex items-center gap-3 transition-all text-left ${
                disabled
                  ? "bg-white/[0.02] border-white/5 opacity-30 cursor-not-allowed"
                  : isSelected
                  ? "bg-violet-500/20 border-violet-500/50 ring-1 ring-violet-400"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <span className="text-2xl">{t.flag}</span>
              <div>
                <p className="text-sm font-medium text-white leading-tight">{t.name}</p>
                <p className="text-xs text-slate-500">{isTaken ? "Taken" : isExcluded ? "Already picked" : t.confederation}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WorldCupTeaserPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<TeaserStatus | null>(null);

  const [teamId, setTeamId] = useState<number | null>(null);
  const [championPickId, setChampionPickId] = useState<number | null>(null);
  const [runnerUpPickId, setRunnerUpPickId] = useState<number | null>(null);

  const [section, setSection] = useState<"team" | "champion" | "runnerup">("team");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/world-cup/teaser")
      .then((r) => r.ok ? r.json() : null)
      .then((data: TeaserStatus | null) => {
        if (!data) return;
        setStatus(data);
        if (data.isLive && data.hasRealEntry) {
          router.replace("/world-cup");
          return;
        }
        if (data.preEntry) {
          setTeamId(data.preEntry.teamId);
          setChampionPickId(data.preEntry.championPickId);
          setRunnerUpPickId(data.preEntry.runnerUpPickId);
        }
      });
  }, [router]);

  const save = async () => {
    setSaving(true); setError(""); setSaved(false);
    const res = await fetch("/api/world-cup/teaser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, championPickId, runnerUpPickId }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else { const d = await res.json(); setError(d.error ?? "Something went wrong"); }
  };

  if (!user || !status) return null;

  const { teams, takenTeamIds, playerLiveAt, isLive } = status;
  const teamName = (id: number | null) => id ? teams.find((t) => t.id === id)?.name ?? "" : "";
  const teamFlag = (id: number | null) => id ? teams.find((t) => t.id === id)?.flag ?? "" : "";

  const launchLabel = playerLiveAt
    ? new Date(playerLiveAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "TBD";

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/feed" className="text-slate-400 hover:text-white text-sm">←</Link>
            <div>
              <h1 className="text-lg font-bold text-white">⚽ World Cup 2026</h1>
              <p className="text-xs text-slate-500">Pre-event · Opens {launchLabel}</p>
            </div>
          </div>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Countdown banner */}
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-4 text-center space-y-1">
          <p className="text-2xl">🏆</p>
          <p className="font-bold text-white">World Cup 2026 {isLive ? "is Live!" : "is Coming"}</p>
          <p className="text-sm text-slate-400">
            {isLive
              ? "The event is open — lock in your picks now."
              : `Lock in your team and predictions before ${launchLabel}. No points needed until launch.`}
          </p>
        </div>

        {/* Progress summary */}
        {(teamId || championPickId || runnerUpPickId) && (
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 space-y-2">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Your picks so far</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`rounded-xl p-2 ${teamId ? "bg-violet-500/15 border border-violet-500/30" : "bg-white/[0.03] border border-white/5"}`}>
                <p className="text-lg">{teamId ? teamFlag(teamId) : "—"}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">{teamId ? teamName(teamId) : "No team"}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Backing</p>
              </div>
              <div className={`rounded-xl p-2 ${championPickId ? "bg-amber-500/15 border border-amber-500/30" : "bg-white/[0.03] border border-white/5"}`}>
                <p className="text-lg">{championPickId ? teamFlag(championPickId) : "—"}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">{championPickId ? teamName(championPickId) : "No pick"}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Champion</p>
              </div>
              <div className={`rounded-xl p-2 ${runnerUpPickId ? "bg-sky-500/15 border border-sky-500/30" : "bg-white/[0.03] border border-white/5"}`}>
                <p className="text-lg">{runnerUpPickId ? teamFlag(runnerUpPickId) : "—"}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">{runnerUpPickId ? teamName(runnerUpPickId) : "No pick"}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Finalist</p>
              </div>
            </div>
          </div>
        )}

        {/* Section tabs */}
        <div className="flex rounded-xl bg-white/5 p-1 gap-1">
          {(["team", "champion", "runnerup"] as const).map((s) => {
            const labels = { team: "My Team", champion: "Champion", runnerup: "Finalist" };
            return (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  section === s ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {labels[s]}
              </button>
            );
          })}
        </div>

        {section === "team" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="font-semibold text-white">Which team are you backing?</p>
              <p className="text-xs text-slate-500">This will pre-fill your entry when the event opens (costs 500 pts at launch).</p>
            </div>
            <TeamGrid
              teams={teams}
              selected={teamId}
              takenIds={takenTeamIds}
              onSelect={setTeamId}
            />
          </div>
        )}

        {section === "champion" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="font-semibold text-white">Who wins the World Cup?</p>
              <p className="text-xs text-slate-500">Your predicted champion. This doesn&apos;t have to be the team you&apos;re backing.</p>
            </div>
            <TeamGrid
              teams={teams}
              selected={championPickId}
              takenIds={[]}
              exclude={runnerUpPickId}
              onSelect={setChampionPickId}
            />
          </div>
        )}

        {section === "runnerup" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="font-semibold text-white">Who makes the final?</p>
              <p className="text-xs text-slate-500">Your predicted finalist — the team that faces your champion in the final.</p>
            </div>
            <TeamGrid
              teams={teams}
              selected={runnerUpPickId}
              takenIds={[]}
              exclude={championPickId}
              onSelect={setRunnerUpPickId}
            />
          </div>
        )}

        {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2">
        <div className="max-w-lg mx-auto">
          <button
            onClick={save}
            disabled={saving || (!teamId && !championPickId && !runnerUpPickId)}
            className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all ${
              saved
                ? "bg-emerald-500 text-white"
                : "btn-primary disabled:opacity-40"
            }`}
          >
            {saving ? "Saving..." : saved ? "✓ Picks saved!" : "Save my picks"}
          </button>
        </div>
      </div>

      <Navbar />
    </div>
  );
}
