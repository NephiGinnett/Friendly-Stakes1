"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPoints } from "@/lib/utils";

type BigBetEntry = {
  id: number;
  userId: number;
  username: string;
  title: string;
  description: string;
  stake: number;
  multiplier: number;
  isAllIn: boolean;
  createdAt: string;
};

type CompletedBet = {
  id: number;
  username: string;
  title: string;
  stake: number;
  outcome: string;
  payout: number;
  multiplier: number;
};

type AdminCasinoStatus = {
  casinoNightActive: boolean;
  casinoNightEndsAt: string | null;
  scratchJackpot: number;
  bigBetRevealAt: string | null;
  bigBetGameType: string;
  pendingBets: BigBetEntry[];
  approvedBet: BigBetEntry | null;
  completedBets: CompletedBet[];
};

export default function AdminCasinoNightPage() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminCasinoStatus | null>(null);
  const [msg, setMsg] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [revealAt, setRevealAt] = useState("");
  const [gameType, setGameType] = useState("");
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(() =>
    fetch("/api/admin/casino")
      .then((r) => { if (r.status === 401) { router.push("/login"); return null; } return r.json(); })
      .then((d) => { if (d) { setStatus(d); setGameType(d.bigBetGameType || ""); } }), [router]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string, extra: object = {}) => {
    setMsg("");
    const res = await fetch("/api/admin/casino", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json();
    setMsg(res.ok ? (d.refunded !== undefined ? `Done — ${d.refunded} bets refunded` : "Done") : (d.error ?? "Error"));
    if (res.ok) load();
  };

  const approveBet = async (id: number) => {
    setActing(id);
    await act("approve_bet", { betId: id });
    setActing(null);
  };

  const refundBet = async (id: number) => {
    setActing(id);
    await act("refund_bet", { betId: id });
    setActing(null);
  };

  const completeBet = async (id: number, outcome: "win" | "loss") => {
    setActing(id);
    await act("complete_bet", { betId: id, outcome });
    setActing(null);
  };

  if (!status) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="text-slate-400 hover:text-white text-sm">&larr; Admin</Link>
          <h1 className="text-lg font-bold text-white">🎰 Casino Night Admin</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {msg && (
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 px-4 py-2 text-sm text-violet-300">{msg}</div>
        )}

        {/* Toggle */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
          <p className="font-bold text-white">Casino Night Status</p>
          <p className="text-sm text-slate-400">
            Currently: <span className={status.casinoNightActive ? "text-emerald-400" : "text-rose-400"}>
              {status.casinoNightActive ? "ACTIVE" : "INACTIVE"}
            </span>
          </p>
          <p className="text-xs text-slate-500">Scratch Jackpot: {formatPoints(status.scratchJackpot)} pts</p>
          {status.casinoNightEndsAt && (
            <p className="text-xs text-slate-500">Ends: {new Date(status.casinoNightEndsAt).toLocaleString()}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
            <button onClick={() => act("toggle_casino", { active: true, endsAt: endsAt || undefined })}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 text-sm">Activate</button>
            <button onClick={() => act("toggle_casino", { active: false })}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 text-sm">Deactivate</button>
          </div>
        </div>

        {/* Show Settings */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
          <p className="font-bold text-white">Live Show Settings</p>
          {status.bigBetRevealAt && (
            <p className="text-xs text-slate-400">Show time: {new Date(status.bigBetRevealAt).toLocaleString()}</p>
          )}
          <div className="flex gap-2">
            <input type="datetime-local" value={revealAt} onChange={(e) => setRevealAt(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
            <button onClick={() => act("set_reveal_time", { revealAt })}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 text-sm">Set Show Time</button>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-slate-500">Game for live stage:</label>
            <select value={gameType} onChange={(e) => setGameType(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white">
              <option value="">Not set</option>
              <option value="roulette">🎡 Roulette</option>
              <option value="blackjack">🃏 Blackjack</option>
              <option value="custom">🎲 Custom</option>
            </select>
            <button onClick={() => act("set_game_type", { gameType })}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-sm">Save</button>
          </div>
        </div>

        {/* Approved VIP */}
        {status.approvedBet && (
          <div className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 p-5 space-y-3">
            <p className="font-bold text-amber-400">🎟️ Tonight&rsquo;s VIP</p>
            <div className="space-y-1">
              <p className="text-white font-semibold">{status.approvedBet.username}</p>
              <p className="text-sm text-slate-300">&ldquo;{status.approvedBet.title}&rdquo;</p>
              <p className="text-sm text-slate-400">{status.approvedBet.description}</p>
              <p className="text-sm text-slate-300">
                {formatPoints(status.approvedBet.stake)} pts · ×{status.approvedBet.multiplier}
                {status.approvedBet.isAllIn && " · ALL IN"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => completeBet(status.approvedBet!.id, "win")}
                disabled={acting === status.approvedBet.id}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-sm disabled:opacity-40">
                ✓ WIN ({formatPoints(Math.floor(status.approvedBet.stake * status.approvedBet.multiplier))} pts)
              </button>
              <button onClick={() => completeBet(status.approvedBet!.id, "loss")}
                disabled={acting === status.approvedBet.id}
                className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 text-sm disabled:opacity-40">
                ✗ LOSS
              </button>
              <button onClick={() => refundBet(status.approvedBet!.id)}
                disabled={acting === status.approvedBet.id}
                className="rounded-lg bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 text-sm disabled:opacity-40">
                Refund
              </button>
            </div>
          </div>
        )}

        {/* Pending Submissions */}
        {status.pendingBets.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <p className="font-bold text-white">Pending Submissions ({status.pendingBets.length})</p>
            <p className="text-xs text-slate-500">Approve one player for tonight&rsquo;s show. All others will be refunded automatically.</p>
            {status.pendingBets.map((b) => (
              <div key={b.id} className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {b.username}
                      {b.isAllIn && <span className="ml-2 text-xs bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full">ALL IN</span>}
                    </p>
                    <p className="text-xs text-slate-300">&ldquo;{b.title}&rdquo;</p>
                    <p className="text-xs text-slate-500">{b.description}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatPoints(b.stake)} pts · ×{b.multiplier} · potential: {formatPoints(Math.floor(b.stake * b.multiplier))} pts
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveBet(b.id)} disabled={acting === b.id || !!status.approvedBet}
                    className="flex-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-sm disabled:opacity-40">
                    🎟️ Approve for Live Show
                  </button>
                  <button onClick={() => refundBet(b.id)} disabled={acting === b.id}
                    className="rounded-lg bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 text-sm disabled:opacity-40">
                    Refund
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!status.approvedBet && status.pendingBets.length === 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
            <p className="text-slate-600 text-sm">No submissions yet.</p>
          </div>
        )}

        {/* Completed */}
        {status.completedBets.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
            <p className="font-bold text-white">Past Shows</p>
            {status.completedBets.map((b) => (
              <div key={b.id} className={`rounded-xl border p-3 ${
                b.outcome === "win" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
              }`}>
                <p className="text-sm text-white">{b.username} — &ldquo;{b.title}&rdquo;</p>
                <p className="text-xs text-slate-400">
                  {b.outcome?.toUpperCase()} · {formatPoints(b.stake)} at ×{b.multiplier}
                  {b.outcome === "win" && ` · payout: ${formatPoints(b.payout)} pts`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
