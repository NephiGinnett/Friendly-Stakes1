"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

type LogEntry = {
  type: "damage" | "attack";
  username: string;
  amount: number;
  source: string | null;
  text: string | null;
  createdAt: string;
};

type LeaderEntry = { username: string; totalDamage: number };

type BossData = {
  active: boolean;
  bossHp: number;
  bossMaxHp: number;
  pct: number;
  defeated: boolean;
  sleeping: boolean;
  nightDamage: number;
  wakeChancePct: number;
  killerUsername: string | null;
  leaderboard: LeaderEntry[];
  recentLogs: LogEntry[];
  myDamage: number;
};

type VictoryData = {
  available: boolean;
  killerUsername: string | null;
  damageBoard: { username: string; hp: number; isKiller: boolean }[];
  healBoard: { username: string; hp: number }[];
};

const QUICK_ATTACKS = [
  { label: "50 pts", pts: 50, hp: 25 },
  { label: "100 pts", pts: 100, hp: 50 },
  { label: "500 pts", pts: 500, hp: 250 },
];

export default function BossPage() {
  const router = useRouter();
  const [boss, setBoss] = useState<BossData | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [myUsername, setMyUsername] = useState("");
  const [attacking, setAttacking] = useState(false);
  const [customAmt, setCustomAmt] = useState("");
  const [msg, setMsg] = useState("");
  const [justKilled, setJustKilled] = useState(false);
  const [wakeEvent, setWakeEvent] = useState<{ flavorText: string; amount: number } | null>(null);
  const [victory, setVictory] = useState<VictoryData | null>(null);

  const load = useCallback(async () => {
    const [meRes, bossRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/house/boss")]);
    if (!meRes.ok) { router.push("/login"); return; }
    const me = await meRes.json();
    setMyPoints(me.points);
    setMyUsername(me.username);
    if (bossRes.ok) {
      const bossData: BossData = await bossRes.json();
      setBoss(bossData);
      // Load victory report if boss is already defeated (e.g. visiting after the fact)
      if (bossData.defeated && !justKilled) {
        const vRes = await fetch("/api/house/boss/victory");
        if (vRes.ok) setVictory(await vRes.json());
      }
    }
  }, [router, justKilled]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const attack = async (pts: number) => {
    if (attacking || pts < 50) return;
    setAttacking(true); setMsg("");
    const res = await fetch("/api/house/boss/attack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: pts }),
    });
    const d = await res.json();
    setAttacking(false);
    if (!res.ok) { setMsg(d.error); return; }
    setMyPoints(d.newPoints);
    if (d.killed) {
      setJustKilled(true);
      // Fetch the full post-battle report
      const vRes = await fetch("/api/house/boss/victory");
      if (vRes.ok) setVictory(await vRes.json());
    }
    if (d.woke && d.wakeResult) setWakeEvent(d.wakeResult);
    load();
  };

  if (!boss) return null;

  const hpPct = boss.bossMaxHp > 0 ? Math.max(0, (boss.bossHp / boss.bossMaxHp) * 100) : 0;
  const hpColor = hpPct > 60 ? "#ef4444" : hpPct > 30 ? "#f97316" : "#fbbf24";

  return (
    <div className="min-h-screen pb-20" style={{ background: "rgb(8,5,15)" }}>
      {/* CRT overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px)" }}
      />

      {/* Wake-up overlay */}
      {wakeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl border border-red-700/60 p-8 text-center space-y-4" style={{ background: "rgb(20,5,5)" }}>
            <p className="text-5xl animate-pulse">👁️</p>
            <p className="text-2xl font-bold font-mono text-red-400 tracking-widest">IT WOKE UP</p>
            <p className="text-slate-300 text-sm font-mono leading-relaxed">{wakeEvent.flavorText}</p>
            <p className="text-xs text-red-700 font-mono mt-2">Your wheel and blackjack privileges are suspended for tomorrow.</p>
            <button
              onClick={() => setWakeEvent(null)}
              className="w-full py-2.5 rounded-xl bg-red-900/40 border border-red-700/40 text-red-300 font-mono font-bold hover:bg-red-900/60 transition-colors"
            >
              I understand.
            </button>
          </div>
        </div>
      )}

      {/* Victory overlay */}
      {(boss.defeated || justKilled) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl border border-amber-500/40 space-y-0 overflow-hidden" style={{ background: "rgb(12,9,4)" }}>

            {/* Header */}
            <div className="px-6 pt-7 pb-5 text-center space-y-2 border-b border-amber-900/40">
              <p className="text-5xl">🏆</p>
              <p className="text-2xl font-bold font-mono text-amber-400 tracking-widest">SYSTEM DEFEATED</p>
              <p className="text-slate-400 text-xs font-mono">The House has fallen. Loot redistributed.</p>
            </div>

            {/* Final blow */}
            {(victory?.killerUsername || boss.killerUsername) && (
              <div className="px-6 py-4 border-b border-amber-900/30 flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="text-xs font-mono text-amber-700 uppercase tracking-widest">Final Blow</p>
                  <p className="font-bold font-mono text-amber-300 text-lg">{victory?.killerUsername ?? boss.killerUsername}</p>
                </div>
              </div>
            )}

            {/* Damage rankings */}
            {victory?.damageBoard && victory.damageBoard.length > 0 && (
              <div className="px-6 py-4 border-b border-amber-900/30 space-y-2">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Damage Dealt</p>
                {victory.damageBoard.map((row, i) => (
                  <div key={row.username} className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-slate-600 w-5">{i + 1}.</span>
                    <span className={`flex-1 ${row.username === myUsername ? "text-violet-300 font-bold" : "text-slate-300"}`}>
                      {row.username}{row.isKiller ? " ⚡" : ""}
                    </span>
                    {i === 0 && <span className="text-xs text-amber-400">🎯</span>}
                    <span className="text-red-400 font-bold">{row.hp} HP</span>
                  </div>
                ))}
              </div>
            )}

            {/* Heal rankings */}
            {victory?.healBoard && victory.healBoard.length > 0 && (
              <div className="px-6 py-4 border-b border-amber-900/30 space-y-2">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">House Healing (Game Losses)</p>
                {victory.healBoard.map((row, i) => (
                  <div key={row.username} className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-slate-600 w-5">{i + 1}.</span>
                    <span className={`flex-1 ${row.username === myUsername ? "text-violet-300 font-bold" : "text-slate-300"}`}>{row.username}</span>
                    {i === 0 && <span className="text-xs text-emerald-500">💊</span>}
                    <span className="text-emerald-600 font-bold">{row.hp} HP</span>
                  </div>
                ))}
              </div>
            )}

            {/* Achievement callouts */}
            {victory?.damageBoard && victory.damageBoard.length > 0 && (
              <div className="px-6 py-4 border-b border-amber-900/30 space-y-1.5">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Awards</p>
                <p className="text-xs font-mono text-amber-300">🎯 Public Enemy #1 → <span className="font-bold">{victory.damageBoard[0].username}</span> (+400 pts + Signal Scrambler)</p>
                {victory.healBoard && victory.healBoard.length > 0 && (
                  <p className="text-xs font-mono text-emerald-400">💊 Unwitting Accomplice → <span className="font-bold">{victory.healBoard[0].username}</span> (+300 pts)</p>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="px-6 py-5">
              <button
                onClick={() => { setJustKilled(false); router.push("/house"); }}
                className="w-full py-3 rounded-xl font-bold font-mono text-sm tracking-widest text-amber-300 border border-amber-700/40 transition-colors hover:bg-amber-900/20"
                style={{ background: "rgba(120,53,15,0.2)" }}
              >
                RETURN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b" style={{ background: "rgba(8,5,15,0.95)", borderColor: "#7f1d1d" }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold font-mono tracking-widest text-red-400">⚡ THE HOUSE</h1>
            <p className="text-xs font-mono text-red-900">BOSS BATTLE — PHASE 4</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-600 font-mono">YOUR BALANCE</p>
            <p className="text-sm font-bold text-violet-400 font-mono">{myPoints.toLocaleString()} pts</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Boss portrait + HP */}
        <div className="rounded-2xl p-5 space-y-4 border" style={{ background: "rgb(10,5,18)", borderColor: "#7f1d1d" }}>
          <div className="flex items-center gap-4">
            <div
              className="shrink-0 w-20 h-20 rounded-xl border flex flex-col items-center justify-center font-mono"
              style={{ background: "rgb(5,2,10)", borderColor: "#7f1d1d" }}
            >
              <pre className="text-red-500 text-[8px] leading-tight select-none">{
`┌─────┐
│(💀)│
│HOUSE│
└─────┘`}
              </pre>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs font-mono text-red-900">[ SYSTEM INTEGRITY ]</p>
              <div className="relative h-7 rounded-full overflow-hidden border" style={{ background: "rgb(20,5,5)", borderColor: "#7f1d1d" }}>
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-1000 rounded-full"
                  style={{ width: `${hpPct}%`, background: `linear-gradient(90deg, ${hpColor}88, ${hpColor})` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-white drop-shadow">
                  {boss.bossHp.toLocaleString()} / {boss.bossMaxHp.toLocaleString()} HP
                </div>
              </div>
              <p className="text-xs font-mono text-red-800">
                {boss.active && !boss.defeated ? `${hpPct.toFixed(1)}% integrity remaining` : "SYSTEM DEFEATED"}
              </p>
            </div>
          </div>

          {/* My damage */}
          <div className="rounded-lg px-3 py-2 text-xs font-mono flex items-center justify-between" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
            <span className="text-violet-400">Your damage dealt</span>
            <span className="text-violet-300 font-bold">{boss.myDamage} HP</span>
          </div>
        </div>

        {/* Sleeping notice + risk meter */}
        {boss.active && !boss.defeated && boss.sleeping && (
          <div className="rounded-2xl p-5 border border-slate-700/40 space-y-4" style={{ background: "rgb(10,10,18)" }}>
            <div className="text-center space-y-1">
              <p className="text-3xl">💤</p>
              <p className="font-bold font-mono text-slate-400 tracking-widest">THE HOUSE IS SLEEPING</p>
              <p className="text-xs font-mono text-slate-600">Strike window: 6:00 AM – 8:00 PM · You may still attack</p>
            </div>

            {/* Wake chance meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">WAKE CHANCE</span>
                <span
                  className="font-bold"
                  style={{ color: boss.wakeChancePct >= 60 ? "#ef4444" : boss.wakeChancePct >= 30 ? "#f97316" : "#facc15" }}
                >
                  {boss.wakeChancePct}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${boss.wakeChancePct}%`,
                    background: boss.wakeChancePct >= 60
                      ? "linear-gradient(90deg,#b91c1c,#ef4444)"
                      : boss.wakeChancePct >= 30
                      ? "linear-gradient(90deg,#c2410c,#f97316)"
                      : "linear-gradient(90deg,#a16207,#facc15)",
                  }}
                />
              </div>
              <p className="text-xs font-mono text-slate-700">
                {boss.nightDamage} HP dealt tonight · each hit raises the chance
                {boss.wakeChancePct > 0 && " · if it wakes, it strikes you and bans tomorrow's privileges"}
              </p>
            </div>
          </div>
        )}

        {/* Attack panel */}
        {boss.active && !boss.defeated && (
          <div className="rounded-2xl p-5 space-y-4 border border-violet-900/40" style={{ background: "rgb(12,8,22)" }}>
            <p className="text-xs font-mono text-violet-400/70">[ CONTRIBUTE RESOURCES — 2 pts = 1 HP ]</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ATTACKS.map(qa => (
                <button
                  key={qa.pts}
                  onClick={() => attack(qa.pts)}
                  disabled={attacking || myPoints < qa.pts}
                  className="py-3 rounded-xl text-center font-mono text-sm transition-colors border disabled:opacity-40"
                  style={{ background: "rgba(124,58,237,0.15)", borderColor: "rgba(124,58,237,0.3)", color: "#c4b5fd" }}
                >
                  <p className="font-bold">{qa.label}</p>
                  <p className="text-xs opacity-70">= {qa.hp} HP</p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number" min="50" placeholder="Custom pts"
                className="input flex-1 text-sm font-mono"
                value={customAmt}
                onChange={e => setCustomAmt(e.target.value)}
              />
              <button
                onClick={() => { attack(parseInt(customAmt) || 0); setCustomAmt(""); }}
                disabled={attacking || !customAmt}
                className="px-5 py-2 rounded-xl font-bold font-mono text-sm text-white transition-colors disabled:opacity-40"
                style={{ background: attacking ? "#4c1d95" : "linear-gradient(135deg,#dc2626,#9333ea)" }}
              >
                {attacking ? "..." : "⚡ ATTACK"}
              </button>
            </div>
            {msg && <p className="text-rose-400 text-sm font-mono">{msg}</p>}
          </div>
        )}

        {/* Leaderboard */}
        {boss.leaderboard.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono text-slate-500">[ DAMAGE LEADERBOARD ]</p>
            {boss.leaderboard.map((entry, i) => (
              <div key={entry.username} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="font-mono text-slate-500 w-5 text-sm">{i + 1}.</span>
                <span className={`font-mono text-sm font-medium flex-1 ${entry.username === myUsername ? "text-violet-300" : "text-slate-300"}`}>
                  {entry.username}
                  {entry.username === boss.killerUsername && " ⚡"}
                </span>
                <span className="font-mono text-sm text-red-400 font-bold">{entry.totalDamage} HP</span>
              </div>
            ))}
          </div>
        )}

        {/* Combat log */}
        <div className="space-y-2 pb-2">
          <p className="text-xs font-mono text-slate-500">[ COMBAT LOG ]</p>
          {boss.recentLogs.length === 0 && (
            <p className="text-xs text-slate-700 font-mono text-center py-4">No engagements yet.</p>
          )}
          {boss.recentLogs.map((entry, i) => (
            <div
              key={i}
              className="px-3 py-2.5 rounded-lg text-xs font-mono"
              style={{
                background: entry.type === "attack" ? "rgba(239,68,68,0.08)" : "rgba(124,58,237,0.08)",
                border: `1px solid ${entry.type === "attack" ? "rgba(239,68,68,0.15)" : "rgba(124,58,237,0.15)"}`,
              }}
            >
              {entry.type === "damage" ? (
                <span className="text-violet-300">
                  <span className="text-violet-400 font-bold">{entry.username}</span> dealt <span className="font-bold">{entry.amount} HP</span> to The House
                </span>
              ) : (
                <span className="text-red-300">{entry.text}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Navbar />
    </div>
  );
}
