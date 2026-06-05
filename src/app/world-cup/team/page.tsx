"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

type Team = { id: number; name: string; code: string; flag: string; confederation: string };
type Match = {
  id: number; homeTeamName: string; awayTeamName: string; kickoff: string;
  stage: string; group: string | null; status: string;
  homeScore: number | null; awayScore: number | null; winner: string | null;
  homeTeamId: number | null; awayTeamId: number | null;
};
type Record = { played: number; wins: number; draws: number; losses: number };
type TeamData = { team: Team; record: Record; upcoming: Match[]; recent: Match[]; allMatches: Match[] };

function predictionUrl(m: Match, teamName: string): string {
  const kickoff = new Date(m.kickoff);
  const title = encodeURIComponent(`${m.homeTeamName} vs ${m.awayTeamName} — ${m.stage}`);
  const position = encodeURIComponent(`${teamName} wins`);
  const deadlineDate = kickoff.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const deadlineTime = kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `/wagers/new?title=${title}&position=${position}&deadlineDate=${deadlineDate}&deadlineTime=${deadlineTime}`;
}

function matchResult(m: Match, teamId: number): "W" | "D" | "L" | null {
  if (m.status !== "FINISHED") return null;
  if (m.winner === "DRAW") return "D";
  if ((m.homeTeamId === teamId && m.winner === "HOME_TEAM") ||
      (m.awayTeamId === teamId && m.winner === "AWAY_TEAM")) return "W";
  return "L";
}

export default function TeamRecordPage() {
  const router = useRouter();
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => { if (!r.ok) router.push("/login"); });
    fetch("/api/world-cup/team")
      .then((r) => r.ok ? r.json() : r.json().then((d: { error: string }) => { throw new Error(d.error); }))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pb-20 px-4">
        <p className="text-slate-400">{error}</p>
        <Link href="/world-cup" className="mt-4 text-violet-400 text-sm">← Back to World Cup</Link>
        <Navbar />
      </div>
    );
  }

  if (!data) return null;

  const { team, record, upcoming, recent } = data;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
          <div>
            <h1 className="text-lg font-bold text-white">{team.flag} {team.name}</h1>
            <p className="text-xs text-slate-500">{team.confederation} · World Cup 2026</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Record */}
        <div className="card">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">Tournament Record</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Played", value: record.played, color: "text-white" },
              { label: "Wins", value: record.wins, color: "text-emerald-400" },
              { label: "Draws", value: record.draws, color: "text-amber-400" },
              { label: "Losses", value: record.losses, color: "text-rose-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 rounded-xl py-3">
                <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming matches */}
        {upcoming.length > 0 && (
          <div className="card space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Upcoming</p>
            {upcoming.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white font-medium">{m.homeTeamName} <span className="text-slate-500">vs</span> {m.awayTeamName}</p>
                  <p className="text-xs text-slate-500">{m.stage}{m.group ? ` · Group ${m.group}` : ""}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-xs text-slate-400">{new Date(m.kickoff).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-600">{new Date(m.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  <Link href={predictionUrl(m, team.name)} className="text-xs text-violet-400 hover:text-violet-300 font-medium">
                    Place Prediction →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent results */}
        {recent.length > 0 && (
          <div className="card space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Recent Results</p>
            {recent.map((m) => {
              const result = matchResult(m, team.id);
              const resultColor = result === "W" ? "text-emerald-400 bg-emerald-500/20" : result === "L" ? "text-rose-400 bg-rose-500/20" : "text-amber-400 bg-amber-500/20";
              return (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white">{m.homeTeamName} {m.homeScore ?? "–"}:{m.awayScore ?? "–"} {m.awayTeamName}</p>
                    <p className="text-xs text-slate-500">{m.stage}{m.group ? ` · Group ${m.group}` : ""}</p>
                  </div>
                  {result && (
                    <span className={`text-xs font-bold font-mono px-2 py-1 rounded-lg ${resultColor}`}>{result}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {record.played === 0 && upcoming.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            No match data yet. Check back once the tournament begins.
          </div>
        )}
      </div>
      <Navbar />
    </div>
  );
}
