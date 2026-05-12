"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { SPIN_OUTCOMES, HOUSE_PHASES, isRed } from "@/lib/house";
import type { Phase, SpinOutcome } from "@/lib/house";

type HouseData = {
  phase: Phase;
  config: (typeof HOUSE_PHASES)[Phase];
  bossActive: boolean;
  hasSpin: boolean;
  lastSpinLabel: string | null;
  hasActiveBlackjack: boolean;
};

type BJGame = {
  playerHand: string[];
  dealerHand: string[];
  playerValue: number;
  dealerValue: number;
  dealerFullValue: number;
  bet: number;
  status: string;
};

// ── Spin Wheel ──────────────────────────────────────────────────────────────

const SEG = 360 / SPIN_OUTCOMES.length;

function wheelTargetDeg(currentDeg: number, outcomeIndex: number): number {
  const segCenter = outcomeIndex * SEG + SEG / 2;
  const offset = (360 - segCenter) % 360;
  return currentDeg + 5 * 360 + offset;
}

function SpinWheel({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const cx = 130, cy = 130, r = 120;
  return (
    <svg
      width="260" height="260"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: spinning ? "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
        display: "block",
      }}
    >
      {SPIN_OUTCOMES.map((outcome, i) => {
        const startAngle = (i * SEG - 90) * (Math.PI / 180);
        const endAngle = ((i + 1) * SEG - 90) * (Math.PI / 180);
        const midAngle = ((i * SEG + SEG / 2 - 90) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const lx = cx + r * 0.65 * Math.cos(midAngle);
        const ly = cy + r * 0.65 * Math.sin(midAngle);
        const textAngle = (i * SEG + SEG / 2 - 90 + 90);
        return (
          <g key={i}>
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
              fill={outcome.color}
              stroke="#0f0f1a"
              strokeWidth="2"
            />
            <text
              x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="9" fontWeight="700"
              transform={`rotate(${textAngle}, ${lx}, ${ly})`}
              style={{ pointerEvents: "none" }}
            >
              {outcome.label}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={12} fill="#0f0f1a" stroke="#7c3aed" strokeWidth="3" />
    </svg>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function Card({ card }: { card: string }) {
  if (card === "??") {
    return (
      <div className="w-11 h-16 rounded-lg bg-violet-900/60 border-2 border-violet-700/60 flex items-center justify-center shadow-lg">
        <span className="text-violet-400 text-lg font-bold">?</span>
      </div>
    );
  }
  const red = isRed(card);
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return (
    <div className={`w-11 h-16 rounded-lg bg-white border-2 border-slate-200 flex flex-col p-1 shadow-lg ${red ? "text-red-600" : "text-slate-900"}`}>
      <span className="text-xs font-bold leading-tight">{rank}</span>
      <span className="text-lg font-bold text-center flex-1 flex items-center justify-center leading-none">{suit}</span>
    </div>
  );
}

// ── Status display ──────────────────────────────────────────────────────────

const BJ_STATUS: Record<string, { label: string; color: string }> = {
  blackjack:    { label: "🃏 Blackjack! You win 1.5×!",  color: "text-amber-400" },
  player_win:   { label: "You win!",                     color: "text-emerald-400" },
  dealer_bust:  { label: "Dealer busts — you win!",      color: "text-emerald-400" },
  player_bust:  { label: "Bust! You lose.",               color: "text-rose-400" },
  dealer_win:   { label: "Dealer wins. Better luck.",     color: "text-rose-400" },
  push:         { label: "Push — bet returned.",          color: "text-amber-400" },
};

// ── Main page ───────────────────────────────────────────────────────────────

export default function HousePage() {
  const router = useRouter();
  const [data, setData] = useState<HouseData | null>(null);
  const [tab, setTab] = useState<"wheel" | "blackjack">("wheel");
  const [points, setPoints] = useState(0);

  // Wheel state
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinOutcome | null>(null);
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [spinMsg, setSpinMsg] = useState("");

  // Blackjack state
  const [bjGame, setBjGame] = useState<BJGame | null>(null);
  const [bjBet, setBjBet] = useState("100");
  const [bjLoading, setBjLoading] = useState(false);
  const [bjMsg, setBjMsg] = useState("");
  const [bjPlaysRemaining, setBjPlaysRemaining] = useState(3);
  const rotRef = useRef(0);

  const load = async () => {
    const [meRes, houseRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/house"),
    ]);
    if (!meRes.ok) { router.push("/login"); return; }
    const me = await meRes.json();
    setPoints(me.points);
    if (!houseRes.ok) return;
    const h: HouseData = await houseRes.json();
    setData(h);
    // Phase 4: no longer auto-redirect — games are still available
  };

  const loadBJ = async () => {
    const res = await fetch("/api/house/blackjack");
    if (res.ok) {
      const d = await res.json();
      setBjGame(d.game);
      if (typeof d.playsRemaining === "number") setBjPlaysRemaining(d.playsRemaining);
    }
  };

  useEffect(() => {
    load();
    loadBJ();
  }, []);

  if (!data) return null;
  const phase = data.phase;
  const cfg = data.config;

  const glitchClass = [
    "",
    "crt-1",
    "crt-2",
    "crt-3",
  ][cfg.glitchLevel];

  // ── Spin handler ──
  const doSpin = async () => {
    if (spinning || data.hasSpin) return;
    setSpinning(true);
    setSpinResult(null);
    setSpinMsg("");
    const res = await fetch("/api/house/spin", { method: "POST" });
    const d = await res.json();
    if (!res.ok) { setSpinMsg(d.error); setSpinning(false); return; }
    const target = wheelTargetDeg(rotRef.current, d.outcomeIndex);
    rotRef.current = target;
    setRotation(target);
    setTimeout(() => {
      setSpinning(false);
      setSpinResult(d.outcome);
      setShowSpinModal(true);
      setPoints(d.newPoints);
      setData(prev => prev ? { ...prev, hasSpin: true, lastSpinLabel: d.outcome.label } : prev);
    }, 4100);
  };

  // ── BJ handlers ──
  const bjDeal = async () => {
    setBjLoading(true); setBjMsg("");
    const res = await fetch("/api/house/blackjack/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bet: parseInt(bjBet) || 100 }),
    });
    const d = await res.json();
    setBjLoading(false);
    if (!res.ok) { setBjMsg(d.error); return; }
    setBjGame(d.game); setPoints(d.newPoints);
    if (typeof d.playsRemaining === "number") setBjPlaysRemaining(d.playsRemaining);
  };

  const bjHit = async () => {
    setBjLoading(true);
    const res = await fetch("/api/house/blackjack/hit", { method: "POST" });
    const d = await res.json();
    setBjLoading(false);
    setBjGame(d.game); setPoints(d.newPoints);
  };

  const bjStand = async () => {
    setBjLoading(true);
    const res = await fetch("/api/house/blackjack/stand", { method: "POST" });
    const d = await res.json();
    setBjLoading(false);
    setBjGame(d.game); setPoints(d.newPoints);
  };

  const bjClear = () => {
    // Don't delete the row — dailyPlays/dailyDate live on it.
    // The next deal upserts over it and reads the count correctly.
    setBjGame(null); setBjMsg(""); setBjLoading(false);
  };

  const bjActive = bjGame?.status === "active";
  const bjSettled = bjGame && !bjActive;
  const bjStatus = bjGame ? BJ_STATUS[bjGame.status] : null;

  return (
    <div className={`min-h-screen pb-20 ${glitchClass}`}>
      {/* CRT overlays */}
      {cfg.glitchLevel >= 1 && (
        <div
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
            opacity: [0, 0.5, 0.8, 1][cfg.glitchLevel],
          }}
        />
      )}

      {/* Spin result modal */}
      {showSpinModal && spinResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
          <div
            className="w-full max-w-sm rounded-2xl p-8 text-center space-y-4 border"
            style={{ background: "rgb(10,8,20)", borderColor: spinResult.color + "80" }}
          >
            <p className="text-xs font-mono text-slate-500 tracking-widest">THE HOUSE DECLARES</p>
            <p
              className="text-4xl font-bold font-mono tracking-widest"
              style={{ color: spinResult.color }}
            >
              {spinResult.label}
            </p>
            {spinResult.amount > 0 && (
              <p className="text-lg text-emerald-400 font-mono font-bold">+{spinResult.amount} pts added</p>
            )}
            {spinResult.amount < 0 && (
              <p className="text-lg text-rose-400 font-mono font-bold">{spinResult.amount} pts deducted</p>
            )}
            {spinResult.amount === 0 && spinResult.item && (
              <p className="text-lg text-violet-300 font-mono font-bold">Item received!</p>
            )}
            <p className="text-sm text-slate-500 font-mono">New balance: {points.toLocaleString()} pts</p>
            <button
              onClick={() => setShowSpinModal(false)}
              className="w-full py-2.5 rounded-xl font-bold font-mono text-sm transition-colors border"
              style={{ background: spinResult.color + "22", borderColor: spinResult.color + "60", color: spinResult.color }}
            >
              ACKNOWLEDGED
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/95 backdrop-blur-lg border-b border-violet-900/40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-widest font-mono" style={{ color: phase >= 2 ? "#4ade80" : "#a78bfa" }}>
              ▌THE HOUSE▐
            </h1>
            <p className="text-xs font-mono" style={{ color: phase >= 2 ? "#4ade8099" : "#6b7280" }}>
              {cfg.tagline}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 font-mono">BALANCE</p>
            <p className="text-sm font-bold text-violet-400 font-mono">{points.toLocaleString()} pts</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Portrait + dialogue */}
        <div
          className="rounded-2xl p-5 space-y-3 border"
          style={{
            background: "rgb(10,10,18)",
            borderColor: phase >= 3 ? "#7f1d1d" : "#3730a3",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="shrink-0 w-16 h-16 rounded-xl flex items-center justify-center text-3xl border font-mono"
              style={{
                borderColor: phase >= 3 ? "#7f1d1d" : "#4c1d95",
                background: "rgb(5,5,12)",
                animation: phase >= 3 ? "pulse 2s infinite" : undefined,
              }}
            >
              {phase >= 3 ? "💀" : "👁️"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono mb-1" style={{ color: phase >= 2 ? "#4ade80" : "#6b7280" }}>
                SYS:HOUSE &gt; PHASE_{phase} &gt; DIALOGUE
              </p>
              <p className="text-sm font-mono leading-relaxed" style={{ color: phase >= 2 ? "#bbf7d0" : "#e2e8f0" }}>
                &ldquo;{cfg.greeting}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Phase 3 locked state */}
        {cfg.spinLocked && phase < 4 && (
          <div className="rounded-2xl p-8 text-center border border-red-900/40 bg-red-950/20 space-y-3">
            <p className="text-4xl">⚠️</p>
            <p className="font-bold text-red-400 font-mono tracking-widest">ALL SERVICES OFFLINE</p>
            <p className="text-sm text-slate-500 font-mono">Maintenance in progress. Stand by.</p>
            {data.bossActive && (
              <button
                onClick={() => router.push("/house/boss")}
                className="mt-2 px-6 py-3 rounded-xl bg-red-900/40 border border-red-700/60 text-red-300 font-bold font-mono hover:bg-red-900/60 transition-colors"
              >
                ⚡ ENGAGE THE HOUSE
              </button>
            )}
          </div>
        )}

        {/* Phase 4: boss link + absorption warning */}
        {phase === 4 && (
          <div className="space-y-2">
            <button
              onClick={() => router.push("/house/boss")}
              className="w-full py-3 rounded-2xl font-bold font-mono tracking-widest text-red-300 border border-red-700/60 transition-colors hover:bg-red-900/20"
              style={{ background: "rgb(20,5,5)" }}
            >
              ⚡ ENTER BOSS BATTLE
            </button>
            <div className="rounded-xl px-4 py-2 text-center border border-red-900/40" style={{ background: "rgba(127,29,29,0.15)" }}>
              <p className="text-xs font-mono text-red-500">⚠ RESOURCE ABSORPTION ACTIVE — your losses heal The House</p>
            </div>
          </div>
        )}

        {/* Games (phases 0–2, and phase 4) */}
        {(!cfg.spinLocked || phase === 4) && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 rounded-xl bg-white/5 p-1">
              {(["wheel", "blackjack"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors font-mono ${
                    tab === t ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t === "wheel" ? "🎡 SPIN WHEEL" : "🃏 BLACKJACK"}
                </button>
              ))}
            </div>

            {/* ─── Wheel tab ─── */}
            {tab === "wheel" && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-4">
                  {/* Pointer */}
                  <div className="w-0 h-0" style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "18px solid #7c3aed" }} />

                  {/* Wheel */}
                  <div className="relative">
                    <SpinWheel rotation={rotation} spinning={spinning} />
                  </div>

                  {spinMsg && <p className="text-sm text-rose-400 text-center font-mono">{spinMsg}</p>}

                  {data.hasSpin ? (
                    <div className="text-center space-y-1">
                      <p className="text-sm text-slate-500 font-mono">DAILY SPIN USED</p>
                      {data.lastSpinLabel && <p className="text-xs text-slate-600 font-mono">Last result: {data.lastSpinLabel}</p>}
                      <p className="text-xs text-slate-600 font-mono">Come back tomorrow.</p>
                    </div>
                  ) : (
                    <button
                      onClick={doSpin}
                      disabled={spinning}
                      className="px-10 py-3 rounded-xl font-bold font-mono text-white transition-all text-lg tracking-widest"
                      style={{ background: spinning ? "#4c1d95" : "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                    >
                      {spinning ? "SPINNING..." : "▶ SPIN"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─── Blackjack tab ─── */}
            {tab === "blackjack" && (
              <div className="space-y-4">
                {/* Table felt */}
                <div className="rounded-2xl p-5 space-y-4 border border-emerald-900/40" style={{ background: "rgb(5,20,10)" }}>
                  {!bjGame && (
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-mono text-emerald-300/70">[ PLACE YOUR BET ]</p>
                        <p className="text-xs font-mono text-emerald-700">{bjPlaysRemaining} hand{bjPlaysRemaining !== 1 ? "s" : ""} left today</p>
                      </div>
                      <div className="flex gap-2 justify-center">
                        {[50, 100, 200, 500].map(v => (
                          <button
                            key={v}
                            onClick={() => setBjBet(String(v))}
                            className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold transition-colors ${
                              bjBet === String(v) ? "bg-emerald-700 text-white" : "bg-emerald-900/40 text-emerald-400 hover:bg-emerald-800/60"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 max-w-xs mx-auto">
                        <input
                          type="number" min="50"
                          className="input flex-1 text-sm font-mono text-center"
                          placeholder="Custom bet"
                          value={bjBet}
                          onChange={e => setBjBet(e.target.value)}
                        />
                        <button
                          onClick={bjDeal}
                          disabled={bjLoading}
                          className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold font-mono transition-colors"
                        >
                          DEAL
                        </button>
                      </div>
                      {bjMsg && <p className="text-sm text-rose-400 font-mono">{bjMsg}</p>}
                    </div>
                  )}

                  {bjGame && (
                    <div className="space-y-5">
                      {/* Dealer hand */}
                      <div>
                        <p className="text-xs font-mono text-emerald-400/60 mb-2">
                          DEALER {bjActive ? `[ ${bjGame.dealerValue} ]` : `[ ${bjGame.dealerFullValue} ]`}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {bjGame.dealerHand.map((c, i) => <Card key={i} card={c} />)}
                        </div>
                      </div>

                      {/* Player hand */}
                      <div>
                        <p className="text-xs font-mono text-emerald-400/60 mb-2">YOU [ {bjGame.playerValue} ] — Bet: {bjGame.bet} pts</p>
                        <div className="flex gap-2 flex-wrap">
                          {bjGame.playerHand.map((c, i) => <Card key={i} card={c} />)}
                        </div>
                      </div>

                      {/* Status */}
                      {bjSettled && bjStatus && (
                        <p className={`text-center font-bold font-mono text-lg ${bjStatus.color}`}>{bjStatus.label}</p>
                      )}

                      {/* Action buttons */}
                      {bjActive && (
                        <div className="flex gap-2">
                          <button onClick={bjHit} disabled={bjLoading} className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold font-mono transition-colors text-sm">HIT</button>
                          <button onClick={bjStand} disabled={bjLoading} className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold font-mono transition-colors text-sm">STAND</button>
                        </div>
                      )}

                      {bjSettled && (
                        <button onClick={bjClear} className="w-full py-2 rounded-xl bg-emerald-900/40 border border-emerald-800/40 text-emerald-400 font-mono text-sm hover:bg-emerald-900/60 transition-colors">
                          DEAL AGAIN
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Navbar />
    </div>
  );
}
