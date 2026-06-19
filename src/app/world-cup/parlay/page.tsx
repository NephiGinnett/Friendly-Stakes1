"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { formatPoints } from "@/lib/utils";

const MULTIPLIERS = [2, 3, 5, 8, 13];

type Team = { name: string; flag: string };
type Match = { id: number; homeTeamName: string; awayTeamName: string; kickoff: string; stage: string; homeTeamId: number | null; awayTeamId: number | null };
type Opponent = { userId: number; username: string; confidenceStake: number };
type Leg = { id: number; order: number; description: string; accepted: boolean | null; proposerVote: boolean | null; opponentVote: boolean | null; result: boolean | null };
type ParlayData = {
  id: number; status: string; costPerLeg: number; totalEscrowed: number; payout: number;
  proposerWon: boolean | null;
  proposer: { id: number; username: string };
  opponent: { id: number; username: string };
  legs: Leg[];
  match?: { homeTeamName: string; awayTeamName: string; stage: string };
};
type PageData = {
  myTeam: Team; isProxy: boolean; confidenceStake: number; monitorCans: number;
  nextMatch: Match | null; opponent: Opponent | null;
  canPropose: boolean; proposalDeadline: string | null;
  existingParlay: ParlayData | null;
  history: ParlayData[];
  multipliers: number[];
};

const COST_OPTIONS = [100, 200, 300];

export default function ParlayPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; points: number } | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState("");

  // Propose form state
  const [activeLegCount, setActiveLegCount] = useState(3);
  const [legDescs, setLegDescs] = useState(["", "", "", "", ""]);
  const [costPerLeg, setCostPerLeg] = useState(100);

  // Respond state (opponent accepts/rejects each leg)
  const [responses, setResponses] = useState<Record<number, boolean>>({});

  // Vote state
  const [votes, setVotes] = useState<Record<number, boolean>>({});

  const fetchAll = () => {
    fetch("/api/world-cup/parlay").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setData(d); });
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
  };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); }).then(setUser);
    fetch("/api/world-cup/parlay")
      .then((r) => r.ok ? r.json() : r.json().then((d: { error: string }) => { throw new Error(d.error); }))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [router]);

  const propose = async () => {
    if (!data?.nextMatch) return;
    const usedLegs = legDescs.slice(0, activeLegCount).map((d, i) => ({ order: i + 1, description: d }));
    if (usedLegs.some((l) => !l.description.trim())) { setError("Fill in all active leg descriptions"); return; }
    setLoading("propose"); setError(""); setMsg("");
    const res = await fetch("/api/world-cup/parlay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: data.nextMatch.id, costPerLeg, legs: usedLegs }),
    });
    const d = await res.json();
    setLoading("");
    if (res.ok) { setMsg("Parlay sent! Waiting for your opponent to respond."); fetchAll(); }
    else setError(d.error ?? "Something went wrong");
  };

  const respond = async () => {
    if (!data?.existingParlay) return;
    const legResponses = data.existingParlay.legs.map((l) => ({
      legId: l.id,
      accepted: responses[l.id] ?? true, // default accept
    }));
    setLoading("respond"); setError(""); setMsg("");
    const res = await fetch("/api/world-cup/parlay/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parlayId: data.existingParlay.id, responses: legResponses }),
    });
    const d = await res.json();
    setLoading("");
    if (res.ok) {
      setMsg(d.cancelled
        ? "All legs rejected — parlay cancelled, proposer refunded."
        : `Responded! ${d.acceptedCount} leg(s) active. You earned 🥤 ${d.cansEarned} MONITOR can${d.cansEarned !== 1 ? "s" : ""}.`
      );
      fetchAll();
    } else setError(d.error ?? "Something went wrong");
  };

  const vote = async () => {
    if (!data?.existingParlay) return;
    const activeLegVotes = data.existingParlay.legs
      .filter((l) => l.accepted === true)
      .map((l) => ({ legId: l.id, success: votes[l.id] ?? false }));
    setLoading("vote"); setError(""); setMsg("");
    const res = await fetch("/api/world-cup/parlay/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parlayId: data.existingParlay.id, votes: activeLegVotes }),
    });
    const d = await res.json();
    setLoading("");
    if (res.ok) {
      if (d.settled) {
        const canMsg = isProposer && d.proposerCansEarned > 0 ? ` · 🥤 +${d.proposerCansEarned} MONITOR` : "";
        setMsg(d.proposerWon
          ? `🎉 Parlay succeeded! Payout: ${formatPoints(d.payout)} pts${canMsg}`
          : `Parlay failed. Opponent keeps the escrow.${canMsg}`);
      } else {
        setMsg("Vote recorded. Waiting for the other player.");
      }
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

  const { myTeam, isProxy, monitorCans, nextMatch, opponent, canPropose, proposalDeadline, existingParlay, history } = data;
  const isProposer = existingParlay?.proposer.id === user.id;
  const isOpponent = existingParlay?.opponent.id === user.id;
  const activeLegCount2 = existingParlay ? existingParlay.legs.filter((l) => l.accepted === true).length : 0;
  const alreadyVoted = existingParlay?.legs.filter((l) => l.accepted).some(
    (l) => isProposer ? l.proposerVote !== null : l.opponentVote !== null
  );

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
          <div>
            <h1 className="text-lg font-bold text-white">🎰 Parlay</h1>
            <p className="text-xs text-slate-500">{myTeam.flag} {myTeam.name}{isProxy ? " · proxy" : ""}</p>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-white/5 rounded-xl px-3 py-1.5">
            <span className="text-sm">🥤</span>
            <span className="text-sm font-bold font-mono text-white">{monitorCans}</span>
            <span className="text-xs text-slate-500 ml-1">MONITOR</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {msg && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400 text-center">{msg}</div>}
        {error && <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2 text-sm text-rose-400 text-center">{error}</div>}

        {/* ── VOTE PHASE ── */}
        {existingParlay && (existingParlay.status === "voting" || existingParlay.status === "active") && (
          <div className="card space-y-4">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">
              {existingParlay.status === "voting" ? "Voting — how did the legs land?" : "Match finished — cast your votes"}
            </p>
            <p className="text-sm text-slate-400">
              {isProposer ? "You" : existingParlay.proposer.username} proposed vs{" "}
              {isProposer ? existingParlay.opponent.username : "you"}
            </p>
            <div className="space-y-2">
              {existingParlay.legs.filter((l) => l.accepted === true).map((leg) => (
                <div key={leg.id} className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-slate-500 mt-0.5">Leg {leg.order}</span>
                    <p className="text-sm text-slate-300 flex-1">{leg.description}</p>
                  </div>
                  {leg.result !== null ? (
                    <p className={`text-xs font-bold font-mono ${leg.result ? "text-emerald-400" : "text-rose-400"}`}>
                      {leg.result ? "✓ Succeeded" : "✗ Failed"}
                    </p>
                  ) : alreadyVoted ? (
                    <p className="text-xs text-slate-500">Your vote recorded. Waiting for other player.</p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVotes((v) => ({ ...v, [leg.id]: true }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${votes[leg.id] === true ? "bg-emerald-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
                      >✓ Succeeded</button>
                      <button
                        onClick={() => setVotes((v) => ({ ...v, [leg.id]: false }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${votes[leg.id] === false ? "bg-rose-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
                      >✗ Failed</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!alreadyVoted && existingParlay.legs.filter((l) => l.accepted).length > 0 && (
              <button onClick={vote} disabled={loading === "vote"} className="btn-primary w-full">
                {loading === "vote" ? "Submitting..." : "Submit Votes"}
              </button>
            )}
            <div className="flex justify-between text-xs font-mono text-slate-500">
              <span>Active legs: {activeLegCount2} → ×{MULTIPLIERS[activeLegCount2 - 1] ?? "?"}</span>
              <span>Potential payout: {formatPoints(existingParlay.payout)} pts</span>
            </div>
          </div>
        )}

        {/* ── OPPONENT RESPONSE PHASE ── */}
        {existingParlay && existingParlay.status === "pending" && isOpponent && (
          <div className="card space-y-4">
            <p className="text-xs font-mono text-violet-400 uppercase tracking-widest">Parlay challenge from {existingParlay.proposer.username}</p>
            <p className="text-sm text-slate-400">
              Accept or reject each leg. You earn 🥤 {existingParlay.costPerLeg / 100} MONITOR can{existingParlay.costPerLeg > 100 ? "s" : ""} per accepted leg.
            </p>
            <div className="space-y-2">
              {existingParlay.legs.map((leg) => (
                <div key={leg.id} className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-slate-500 mt-0.5">Leg {leg.order}</span>
                    <p className="text-sm text-slate-300 flex-1">{leg.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResponses((r) => ({ ...r, [leg.id]: true }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${responses[leg.id] !== false ? "bg-emerald-600 text-white" : "bg-white/5 text-slate-400"}`}
                    >✓ Accept</button>
                    <button
                      onClick={() => setResponses((r) => ({ ...r, [leg.id]: false }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${responses[leg.id] === false ? "bg-rose-600 text-white" : "bg-white/5 text-slate-400"}`}
                    >✗ Reject</button>
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const willAccept = existingParlay.legs.filter((l) => responses[l.id] !== false).length;
              return (
                <>
                  <div className="flex justify-between text-xs font-mono text-slate-500">
                    <span>{willAccept} leg{willAccept !== 1 ? "s" : ""} active → ×{MULTIPLIERS[willAccept - 1] ?? "?"}</span>
                    <span>🥤 +{willAccept * (existingParlay.costPerLeg / 100)} cans</span>
                  </div>
                  <button onClick={respond} disabled={loading === "respond"} className="btn-primary w-full">
                    {loading === "respond" ? "Submitting..." : "Confirm Response"}
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* ── PROPOSER WAITING ── */}
        {existingParlay && existingParlay.status === "pending" && isProposer && (
          <div className="card space-y-3 text-center">
            <p className="text-xl">⏳</p>
            <p className="text-white font-medium">Waiting for {existingParlay.opponent.username} to respond</p>
            <p className="text-xs text-slate-500">They have until 1h before kickoff.</p>
            <div className="space-y-1">
              {existingParlay.legs.map((l) => (
                <div key={l.id} className="flex items-start gap-2 text-left">
                  <span className="text-xs font-mono text-slate-600 shrink-0">Leg {l.order}</span>
                  <p className="text-xs text-slate-400">{l.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROPOSE FORM ── */}
        {!existingParlay && nextMatch && canPropose && (
          <div className="card space-y-4">
            <p className="text-xs font-mono text-violet-400 uppercase tracking-widest">Propose a parlay</p>
            <div>
              <p className="text-sm text-white font-medium">{nextMatch.homeTeamName} vs {nextMatch.awayTeamName}</p>
              <p className="text-xs text-slate-500">{nextMatch.stage} · Proposing against {opponent?.username}</p>
              {proposalDeadline && (
                <p className="text-xs text-amber-400 mt-1">Deadline: {new Date(proposalDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              )}
            </div>

            {/* Leg count toggles */}
            <div>
              <p className="label mb-2">Number of legs</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setActiveLegCount(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold font-mono transition-colors ${activeLegCount === n ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}>
                    {n}
                    <p className="text-xs opacity-60">×{MULTIPLIERS[n - 1]}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Leg descriptions */}
            <div className="space-y-2">
              {Array.from({ length: activeLegCount }).map((_, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-slate-500 mt-2.5 shrink-0">Leg {i + 1}</span>
                  <input
                    className="input flex-1 text-sm"
                    placeholder={`e.g. "${["Brazil wins", "Messi scores", "No overtime", "3+ total goals", "Brazil leads at half"][i]}"`}
                    value={legDescs[i]}
                    onChange={(e) => setLegDescs((d) => { const n = [...d]; n[i] = e.target.value; return n; })}
                  />
                </div>
              ))}
            </div>

            {/* Cost per leg */}
            <div>
              <p className="label mb-2">Points per leg</p>
              <div className="flex gap-2">
                {COST_OPTIONS.map((c) => (
                  <button key={c} onClick={() => setCostPerLeg(c)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold font-mono transition-colors ${costPerLeg === c ? "bg-amber-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs font-mono text-slate-400 flex justify-between">
              <span>Total escrow: <span className="text-white font-bold">{formatPoints(activeLegCount * costPerLeg)} pts</span></span>
              <span>Payout if won: <span className="text-emerald-400 font-bold">{formatPoints(activeLegCount * costPerLeg * MULTIPLIERS[activeLegCount - 1])} pts</span></span>
            </div>

            {user.points < activeLegCount * costPerLeg && (
              <p className="text-xs text-rose-400 text-center">Not enough points.</p>
            )}

            <button onClick={propose} disabled={loading === "propose" || user.points < activeLegCount * costPerLeg} className="btn-primary w-full">
              {loading === "propose" ? "Sending..." : `Send Parlay — ${formatPoints(activeLegCount * costPerLeg)} pts`}
            </button>
          </div>
        )}

        {/* ── NOT ELIGIBLE ── */}
        {!existingParlay && nextMatch && !canPropose && (
          <div className="card text-center space-y-2">
            <p className="text-2xl">🎰</p>
            {!opponent ? (
              <p className="text-sm text-slate-400">No player is backing the opposing team yet.</p>
            ) : opponent.confidenceStake >= data.confidenceStake ? (
              <div>
                <p className="text-white font-medium">Parlay incoming?</p>
                <p className="text-sm text-slate-400 mt-1">
                  {opponent.username} has a higher confidence stake ({formatPoints(opponent.confidenceStake)} vs {formatPoints(data.confidenceStake)} pts)
                  — they may propose a parlay 2h before kickoff.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-white font-medium">Proposal window opens 2h before kickoff</p>
                <p className="text-sm text-slate-400 mt-1">
                  {nextMatch.homeTeamName} vs {nextMatch.awayTeamName} · {new Date(nextMatch.kickoff).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        )}

        {!nextMatch && (
          <div className="text-center text-slate-500 text-sm py-8">No upcoming matches scheduled yet.</div>
        )}

        {/* ── HISTORY ── */}
        {history.length > 0 && (
          <div className="card space-y-3">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Past parlays</p>
            {history.map((p) => {
              const iProposed = p.proposer.id === user.id;
              const won = iProposed ? p.proposerWon === true : p.proposerWon === false;
              const activeLegCount3 = p.legs.filter((l) => l.accepted).length;
              return (
                <div key={p.id} className="py-2 border-b border-white/5 last:border-0 space-y-1">
                  <div className="flex justify-between">
                    <p className="text-sm text-slate-300">
                      {iProposed ? "You proposed" : `${p.proposer.username} proposed`} · {p.match?.homeTeamName} vs {p.match?.awayTeamName}
                    </p>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg ${won ? "text-emerald-400 bg-emerald-500/20" : "text-rose-400 bg-rose-500/20"}`}>
                      {won ? "WON" : "LOST"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{activeLegCount3} leg{activeLegCount3 !== 1 ? "s" : ""} · ×{MULTIPLIERS[activeLegCount3 - 1] ?? "?"}</p>
                  {iProposed && won && <p className="text-xs text-emerald-400">+{formatPoints(p.payout)} pts</p>}
                  {iProposed && !won && <p className="text-xs text-rose-400">-{formatPoints(p.totalEscrowed)} pts</p>}
                  {!iProposed && won && <p className="text-xs text-emerald-400">+{formatPoints(p.totalEscrowed)} pts (kept escrow)</p>}
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
