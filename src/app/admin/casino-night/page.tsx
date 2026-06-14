"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPoints } from "@/lib/utils";

type BigBetEntry = {
  id: number;
  username: string;
  title: string;
  description: string;
  stake: number;
  multiplier?: number;
  outcome?: string;
  payout?: number;
};

type AdminCasinoStatus = {
  casinoNightActive: boolean;
  casinoNightEndsAt: string | null;
  scratchJackpot: number;
  bigBetRevealAt: string | null;
  pendingBets: BigBetEntry[];
  resolvedBets: BigBetEntry[];
};

export default function AdminCasinoNightPage() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminCasinoStatus | null>(null);
  const [msg, setMsg] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [revealAt, setRevealAt] = useState("");
  const [resolving, setResolving] = useState<number | null>(null);

  const load = useCallback(() =>
    fetch("/api/admin/casino")
      .then((r) => { if (r.status === 401) { router.push("/login"); return null; } return r.json(); })
      .then((d) => { if (d) setStatus(d); }), [router]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string, extra: object = {}) => {
    setMsg("");
    const res = await fetch("/api/admin/casino", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json();
    setMsg(res.ok ? "Done" : (d.error ?? "Error"));
    if (res.ok) load();
  };

  const resolveBet = async (id: number, outcome: "win" | "loss") => {
    setResolving(id);
    await act("resolve_bet", { betId: id, outcome });
    setResolving(null);
  };

  if (!status) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="text-slate-400 hover:text-white text-sm">← Admin</Link>
          <h1 className="text-lg font-bold text-white">🎰 Casino Night Admin</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {msg && (
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/30 px-4 py-2 text-sm text-violet-300">
            {msg}
          </div>
        )}

        {/* Toggle casino night */}
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
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
            />
            <button
              onClick={() => act("toggle_casino", { active: true, endsAt: endsAt || undefined })}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 text-sm"
            >
              Activate
            </button>
            <button
              onClick={() => act("toggle_casino", { active: false })}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 text-sm"
            >
              Deactivate
            </button>
          </div>
        </div>

        {/* Big Bet Show */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <p className="font-bold text-white">Big Bet Show</p>
          {status.bigBetRevealAt && (
            <p className="text-xs text-slate-400">Reveal time: {new Date(status.bigBetRevealAt).toLocaleString()}</p>
          )}

          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={revealAt}
              onChange={(e) => setRevealAt(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
            />
            <button
              onClick={() => act("set_reveal_time", { revealAt })}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 text-sm"
            >
              Set Reveal Time
            </button>
          </div>

          {/* Pending bets to resolve */}
          {status.pendingBets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Resolve Pending Bets</p>
              {status.pendingBets.map((b) => (
                <div key={b.id} className="rounded-xl bg-white/[0.03] border border-white/8 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{b.username}</p>
                      <p className="text-xs text-slate-300">"{b.title}"</p>
                      <p className="text-xs text-slate-500">{b.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatPoints(b.stake)} pts · ×{b.multiplier}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveBet(b.id, "win")}
                      disabled={resolving === b.id}
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      ✓ Win ({formatPoints(Math.floor(b.stake * (b.multiplier ?? 1.5)))} pts)
                    </button>
                    <button
                      onClick={() => resolveBet(b.id, "loss")}
                      disabled={resolving === b.id}
                      className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      ✗ Loss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resolved bets awaiting reveal */}
          {status.resolvedBets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Resolved (Awaiting Reveal)</p>
              {status.resolvedBets.map((b) => (
                <div key={b.id} className={`rounded-xl border p-3 ${
                  b.outcome === "win" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                }`}>
                  <p className="text-sm text-white">{b.username} — "{b.title}"</p>
                  <p className="text-xs text-slate-400">{b.outcome?.toUpperCase()} · payout: {formatPoints(b.payout ?? 0)} pts</p>
                </div>
              ))}
              <button
                onClick={() => act("reveal_all")}
                className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-sm font-semibold"
              >
                📺 Reveal All & Pay Winners
              </button>
            </div>
          )}

          {status.pendingBets.length === 0 && status.resolvedBets.length === 0 && (
            <p className="text-slate-600 text-sm">No bets submitted yet.</p>
          )}
        </div>

      </div>
    </div>
  );
}
