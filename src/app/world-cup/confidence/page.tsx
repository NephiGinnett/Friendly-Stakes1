"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { formatPoints } from "@/lib/utils";

type Team = { id: number; name: string; flag: string };
type Match = {
  id: number; homeTeamName: string; awayTeamName: string; kickoff: string;
  stage: string; homeTeam?: Team | null; awayTeam?: Team | null;
  homeTeamId: number | null; awayTeamId: number | null;
};
type Opponent = { username: string; flag: string; confidenceStake: number };
type HistoryEntry = {
  id: number; winnerStake: number; loserStake: number; winnerPayout: number;
  bonusApplied: boolean; bonusAmount: number; settledAt: string;
  winner: { username: string }; loser: { username: string };
  match: { homeTeamName: string; awayTeamName: string; stage: string; kickoff: string };
};
type ProxyData = { team: Team; nextMatch: Match | null; opponents: Opponent[] };
type PageData = {
  myTeam: Team; confidenceStake: number; proxyConfidenceStake: number;
  nextMatch: Match | null;
  opponents: Opponent[]; history: HistoryEntry[];
  proxy?: ProxyData | null;
  eliminated?: boolean;
};

function MatchSection({ team, nextMatch, opponents, stakeNum }: {
  team: Team; nextMatch: Match | null; opponents: Opponent[]; stakeNum: number;
}) {
  return (
    <>
      {nextMatch ? (
        <div className="card space-y-3">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Next match</p>
          <div>
            <p className="text-white font-medium">{nextMatch.homeTeamName} <span className="text-slate-500">vs</span> {nextMatch.awayTeamName}</p>
            <p className="text-xs text-slate-500">{nextMatch.stage} · {new Date(nextMatch.kickoff).toLocaleDateString()}</p>
          </div>

          {opponents.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Players you&apos;ll face:</p>
              {opponents.map((o) => {
                const myS = stakeNum; const theirS = o.confidenceStake;
                const high = Math.max(myS, theirS); const low = Math.min(myS, theirS);
                const asymmetric = high > 0 && low < high / 2;
                return (
                  <div key={o.username} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                    <span className="text-sm text-slate-300">{o.flag} {o.username}</span>
                    <div className="text-right">
                      <span className="text-xs font-mono text-slate-400">{formatPoints(o.confidenceStake)} pts</span>
                      {asymmetric && <span className="ml-2 text-xs text-amber-400">⚡ asymmetric</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No players are backing the opposing team yet.</p>
          )}
        </div>
      ) : (
        <div className="text-center text-slate-500 text-sm py-8">
          No upcoming matches scheduled for {team.name} yet.
        </div>
      )}
    </>
  );
}

export default function ConfidencePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; points: number; username: string } | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [primaryStake, setPrimaryStake] = useState("");
  const [proxyStake, setProxyStake] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"primary" | "proxy">("primary");

  const fetchAll = () => {
    fetch("/api/world-cup/confidence").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) { setData(d); setPrimaryStake(String(d.confidenceStake)); setProxyStake(String(d.proxyConfidenceStake)); }
    });
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
  };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); }).then(setUser);
    fetch("/api/world-cup/confidence")
      .then((r) => r.ok ? r.json() : r.json().then((d: { error: string }) => { throw new Error(d.error); }))
      .then((d) => { setData(d); setPrimaryStake(String(d.confidenceStake)); setProxyStake(String(d.proxyConfidenceStake)); })
      .catch((e) => setError(e.message));
  }, [router]);

  const saveStake = async () => {
    const isProxy = tab === "proxy";
    const stakeValue = isProxy ? proxyStake : primaryStake;
    setLoading(true); setMsg(""); setError("");
    const res = await fetch("/api/world-cup/confidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stake: parseInt(stakeValue) || 0, target: isProxy ? "proxy" : "primary" }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) {
      const saved = isProxy ? d.proxyConfidenceStake : d.confidenceStake;
      setMsg(`${isProxy ? "Proxy confidence" : "Confidence"} stake set to ${formatPoints(saved)} pts.`);
      fetchAll();
    } else setError(d.error ?? "Something went wrong");
  };

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pb-20 px-4">
        <p className="text-slate-400">{error}</p>
        <Link href="/world-cup" className="mt-4 text-violet-400 text-sm">← Back to World Cup</Link>
        <Navbar />
      </div>
    );
  }
  if (!data || !user) return null;

  if (data.eliminated) {
    return (
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <div>
              <h1 className="text-lg font-bold text-white">🤝 Confidence Wager</h1>
              <p className="text-xs text-slate-500">{data.myTeam.flag} {data.myTeam.name}</p>
            </div>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-10 flex flex-col items-center gap-4 text-center">
          <p className="text-4xl">{data.myTeam.flag}</p>
          <p className="text-white font-bold text-lg">{data.myTeam.name} was eliminated</p>
          <p className="text-slate-400 text-sm max-w-xs">Confidence wagers are no longer available since your team was knocked out of the tournament.</p>
          <Link href="/world-cup/proxy" className="mt-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
            Pick a proxy team →
          </Link>
          <Link href="/world-cup" className="text-slate-500 text-sm hover:text-slate-300">← Back to World Cup</Link>
        </div>
        <Navbar />
      </div>
    );
  }

  const { myTeam, confidenceStake, proxyConfidenceStake, history } = data;
  const isProxyTab = tab === "proxy" && !!data.proxy;
  const stake = isProxyTab ? proxyStake : primaryStake;
  const setStake = isProxyTab ? setProxyStake : setPrimaryStake;
  const currentStake = isProxyTab ? proxyConfidenceStake : confidenceStake;
  const stakeNum = parseInt(stake) || 0;
  const activeTeam = isProxyTab ? data.proxy!.team : myTeam;
  const activeMatch = isProxyTab ? data.proxy!.nextMatch : data.nextMatch;
  const activeOpponents = isProxyTab ? data.proxy!.opponents : data.opponents;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
          <div>
            <h1 className="text-lg font-bold text-white">🤝 Confidence Wager</h1>
            <p className="text-xs text-slate-500">{activeTeam.flag} {activeTeam.name}{tab === "proxy" ? " · proxy" : ""}</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {msg && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400 text-center">{msg}</div>}
        {error && <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2 text-sm text-rose-400 text-center">{error}</div>}

        {/* Team toggle */}
        {data.proxy && (
          <div className="flex gap-2">
            <button
              onClick={() => setTab("primary")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                tab === "primary"
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                  : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <span>{myTeam.flag}</span>
              <span>{myTeam.name}</span>
            </button>
            <button
              onClick={() => setTab("proxy")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                tab === "proxy"
                  ? "bg-violet-500/20 border border-violet-500/40 text-violet-300"
                  : "bg-white/5 border border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <span>{data.proxy.team.flag}</span>
              <span>{data.proxy.team.name}</span>
              <span className="text-xs opacity-60">proxy</span>
            </button>
          </div>
        )}

        {/* How it works */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-slate-400 space-y-1">
          <p className="text-white font-medium text-sm">How it works</p>
          <p>Every time your team plays, your confidence stake goes head-to-head against every player backing the opposing team. No setup required — it fires automatically when the match ends.</p>
          <p className="mt-1 text-slate-500">If one stake is less than half the other, the swing is bigger:</p>
          <p className="pl-2">• High-stake player wins → +33% bonus on top of the pot</p>
          <p className="pl-2">• High-stake player loses → loser pays an extra 33% penalty</p>
        </div>

        {/* Stake setter */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">{isProxyTab ? "Proxy confidence stake" : "Your confidence stake"}</p>
            <p className="text-xs text-slate-500 font-mono">Currently {formatPoints(currentStake)} pts</p>
          </div>
          <p className="text-xs text-slate-400">Applied to every match {activeTeam.name} plays. You have {formatPoints(user.points)} pts.</p>
          <div className="flex gap-2">
            <input
              type="number" min={0} max={user.points}
              className="input flex-1"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
            <button
              onClick={saveStake}
              disabled={loading || stakeNum === currentStake}
              className="btn-primary"
            >
              {loading ? "..." : "Save"}
            </button>
          </div>
          <div className="flex gap-2">
            {[0, 50, 100, 250, 500].map((v) => (
              <button key={v} onClick={() => setStake(String(v))}
                className={`flex-1 py-1 rounded-lg text-xs font-mono transition-colors ${stakeNum === v ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Next match & opponents */}
        <MatchSection team={activeTeam} nextMatch={activeMatch} opponents={activeOpponents} stakeNum={stakeNum} />

        {/* History */}
        {history.length > 0 && (
          <div className="card space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Past results</p>
            {history.map((h) => {
              const iWon = h.winner.username === user.username;
              const net = iWon ? h.winnerPayout - h.winnerStake : -h.loserStake;
              return (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-slate-300">vs {iWon ? h.loser.username : h.winner.username}</p>
                    <p className="text-xs text-slate-500">{h.match.homeTeamName} vs {h.match.awayTeamName}</p>
                    {h.bonusApplied && <p className="text-xs text-amber-400">⚡ asymmetric {iWon ? "bonus" : "penalty"}</p>}
                  </div>
                  <p className={`text-sm font-bold font-mono ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {net >= 0 ? "+" : ""}{formatPoints(net)} pts
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Navbar />
    </div>
  );
}
