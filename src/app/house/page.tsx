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
  casinoOpen: boolean;
};

type SacrificeVoteEntry = { userId: number; username: string; votes: number };
type SacrificeState = {
  open: boolean;
  votes: SacrificeVoteEntry[];
  myVote: { targetId: number; targetUsername: string; weight: number } | null;
  voterCount: number;
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

// ── Password Leak Terminal ───────────────────────────────────────────────────

const NOISE_CHARS = '!@#$%^&*-+=|;:<>?/~{}[]';

function randNoise(len: number): string {
  return Array.from({ length: len }, () =>
    NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]
  ).join('');
}

function randDecoy(len: number): string {
  const pool = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () =>
    pool[Math.floor(Math.random() * pool.length)]
  ).join('');
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type LeakRow = { addr: string; prefix: string; word: string; suffix: string };

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

  // Ad state
  type AdStatus = { viewsToday: number; maxDaily: number; canWatch: boolean; hasWatchedAd: boolean; videos: string[] };
  const [adStatus, setAdStatus] = useState<AdStatus | null>(null);
  const [adPlaying, setAdPlaying] = useState(false);
  const [adVideo, setAdVideo] = useState<string | null>(null);
  const [adWatched, setAdWatched] = useState(false);
  const [adMsg, setAdMsg] = useState<string | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adError, setAdError] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [showPetaiPrompt, setShowPetaiPrompt] = useState(false);
  const [petaiMsg, setPetaiMsg] = useState("");
  const [petaiLoading, setPetaiLoading] = useState(false);

  // Password leak state
  type LeakData = { achievementId: string; name: string; emoji: string; passwords: string[]; refreshedAt: string } | null;
  const [leak, setLeak] = useState<LeakData>(null);
  const [leakRows, setLeakRows] = useState<LeakRow[]>([]);
  const loadLeak = async () => {
    const res = await fetch("/api/house/leak");
    if (res.ok) { const d = await res.json(); setLeak(d.leak ?? null); }
  };

  useEffect(() => {
    if (!leak || !leak.passwords.length) { setLeakRows([]); return; }
    const len = leak.passwords[0].length;
    const TOTAL = 32;
    const decoys = Array.from(
      { length: Math.max(0, TOTAL - leak.passwords.length) },
      () => randDecoy(len)
    );
    const words = shuffleArr([...leak.passwords, ...decoys]);
    setLeakRows(words.map((word, i) => ({
      addr: `0x${(0xF400 + i * (len + 8)).toString(16).toUpperCase().padStart(4, '0')}`,
      prefix: randNoise(Math.floor(Math.random() * 5) + 2),
      word,
      suffix: randNoise(Math.floor(Math.random() * 10) + 4),
    })));
  }, [leak]);

  const loadAdStatus = async () => {
    const res = await fetch("/api/ads/status");
    if (res.ok) setAdStatus(await res.json());
  };

  const startAd = () => {
    if (!adStatus) return;
    if (!adStatus.videos.length) {
      setAdMsg("More ads coming soon.");
      return;
    }
    const video = adStatus.videos[Math.floor(Math.random() * adStatus.videos.length)];
    setAdVideo(video);
    setAdPlaying(true);
    setAdWatched(false);
    setAdError(false);
    setAdMsg(null);
  };

  const finishAd = async () => {
    setAdLoading(true);
    const res = await fetch("/api/ads/watch", { method: "POST" });
    const d = await res.json();
    setAdLoading(false);
    const watchedVideo = adVideo;
    setAdPlaying(false);
    if (res.ok) {
      setAdMsg(`+${d.pointsEarned} pts! ${d.canWatchMore ? `(${5 - d.viewsToday} ad${5 - d.viewsToday !== 1 ? "s" : ""} remaining today)` : "All 5 watched for today."}`);
      if (d.showSubscribePrompt) setShowSubscribePrompt(true);
      if (watchedVideo && /petai/i.test(watchedVideo)) setShowPetaiPrompt(true);
      await loadAdStatus();
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) { const me = await meRes.json(); setPoints(me.points); }
    } else {
      setAdMsg(d.error);
    }
  };

  // Sacrifice state
  const [sacrifice, setSacrifice] = useState<SacrificeState | null>(null);
  const [sacrificeTarget, setSacrificeTarget] = useState("");
  const [sacrificeUseThumb, setSacrificeUseThumb] = useState(false);
  const [sacrificeMsg, setSacrificeMsg] = useState("");
  const [sacrificeLoading, setSacrificeLoading] = useState(false);
  const [hasThumb, setHasThumb] = useState(false);
  const [myUsername, setMyUsername] = useState("");
  const [allPlayers, setAllPlayers] = useState<{ id: number; username: string }[]>([]);

  const loadSacrifice = async () => {
    const res = await fetch("/api/house/sacrifice");
    if (res.ok) setSacrifice(await res.json());
  };

  const load = async () => {
    const [meRes, houseRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/house"),
    ]);
    if (!meRes.ok) { router.push("/login"); return; }
    const me = await meRes.json();
    setPoints(me.points);
    setMyUsername(me.username);
    fetch("/api/users").then(r => r.ok ? r.json() : []).then(setAllPlayers);
    // Check for Thumb on the Scale
    const shopRes = await fetch("/api/shop");
    if (shopRes.ok) {
      const shopData: { owned: { itemType: string; usesLeft: number }[] } = await shopRes.json();
      setHasThumb(shopData.owned.some(i => i.itemType === "thumb" && i.usesLeft > 0));
    }
    if (!houseRes.ok) return;
    const h: HouseData = await houseRes.json();
    setData(h);
    void loadAdStatus();
    void loadLeak();
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
    loadSacrifice();
    const interval = setInterval(loadSacrifice, 10000);
    return () => clearInterval(interval);
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

  const castSacrificeVote = async () => {
    if (!sacrificeTarget || sacrificeLoading) return;
    setSacrificeLoading(true); setSacrificeMsg("");
    const res = await fetch("/api/house/sacrifice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUsername: sacrificeTarget, useThumb: sacrificeUseThumb }),
    });
    const d = await res.json();
    setSacrificeLoading(false);
    if (!res.ok) { setSacrificeMsg(d.error); return; }
    setSacrificeMsg(`Vote cast for ${d.targetUsername}${d.weight > 1 ? " (2× weighted)" : ""}.`);
    setSacrificeUseThumb(false);
    loadSacrifice();
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
          <div className="space-y-4">
            <div className="rounded-2xl p-6 text-center border border-red-900/40 bg-red-950/20 space-y-2">
              <p className="text-3xl">⚠️</p>
              <p className="font-bold text-red-400 font-mono tracking-widest">ALL SERVICES OFFLINE</p>
              <p className="text-sm text-slate-500 font-mono">The House demands tribute. Maintenance in progress.</p>
              {data.bossActive && (
                <button
                  onClick={() => router.push("/house/boss")}
                  className="mt-1 px-6 py-2.5 rounded-xl bg-red-900/40 border border-red-700/60 text-red-300 font-bold font-mono hover:bg-red-900/60 transition-colors"
                >
                  ⚡ ENGAGE THE HOUSE
                </button>
              )}
            </div>

            {/* Sacrifice voting panel */}
            {sacrifice?.open && (
              <div className="rounded-2xl border border-red-800/60 overflow-hidden" style={{ background: "rgb(12,5,5)" }}>
                <div className="px-5 py-4 border-b border-red-900/40 space-y-1">
                  <p className="font-bold font-mono text-red-400 tracking-widest text-sm">🩸 THE HOUSE DEMANDS A SACRIFICE</p>
                  <p className="text-xs font-mono text-slate-500">Vote for who shall be offered. The player with the most votes loses all their points. Half feeds The House. Half is divided among the survivors.</p>
                </div>

                {/* Tally */}
                {sacrifice.votes.length > 0 && (
                  <div className="px-5 py-3 space-y-1.5 border-b border-red-900/30">
                    <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Current Tally — {sacrifice.voterCount} vote{sacrifice.voterCount !== 1 ? "s" : ""} cast</p>
                    {sacrifice.votes.map((v, i) => (
                      <div key={v.userId} className="flex items-center gap-2 text-sm font-mono">
                        <span className="text-slate-600 w-4">{i + 1}.</span>
                        <span className={`flex-1 ${sacrifice.myVote?.targetId === v.userId ? "text-red-300 font-bold" : "text-slate-300"}`}>{v.username}</span>
                        <span className="text-red-500 font-bold">{v.votes} vote{v.votes !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cast vote */}
                <div className="px-5 py-4 space-y-3">
                  {sacrifice.myVote && (
                    <p className="text-xs font-mono text-slate-500">Your vote: <span className="text-red-400 font-bold">{sacrifice.myVote.targetUsername}</span>{sacrifice.myVote.weight > 1 ? " (2×)" : ""} — you may change it below</p>
                  )}
                  <select
                    className="input w-full text-sm font-mono"
                    value={sacrificeTarget}
                    onChange={e => setSacrificeTarget(e.target.value)}
                    style={{ background: "rgb(20,5,5)", borderColor: "#7f1d1d", color: "#fca5a5" }}
                  >
                    <option value="">— choose a player —</option>
                    {allPlayers
                      .filter(p => p.username !== myUsername)
                      .map(p => {
                        const voteRow = sacrifice.votes.find(v => v.username === p.username);
                        return (
                          <option key={p.id} value={p.username}>
                            {p.username}{voteRow ? ` (${voteRow.votes} vote${voteRow.votes !== 1 ? "s" : ""})` : ""}
                          </option>
                        );
                      })
                    }
                  </select>
                  {hasThumb && (
                    <label className="flex items-center gap-2 text-xs font-mono text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sacrificeUseThumb}
                        onChange={e => setSacrificeUseThumb(e.target.checked)}
                        className="accent-red-600"
                      />
                      Use Thumb on the Scale (2× vote weight, consumes 1 charge)
                    </label>
                  )}
                  <button
                    onClick={castSacrificeVote}
                    disabled={!sacrificeTarget || sacrificeLoading}
                    className="w-full py-2.5 rounded-xl font-bold font-mono text-sm text-red-300 border border-red-700/60 transition-colors disabled:opacity-40"
                    style={{ background: "rgba(127,29,29,0.25)" }}
                  >
                    {sacrificeLoading ? "CASTING..." : sacrifice.myVote ? "CHANGE VOTE" : "🩸 CAST VOTE"}
                  </button>
                  {sacrificeMsg && <p className={`text-xs font-mono ${sacrificeMsg.includes("Vote cast") ? "text-emerald-400" : "text-red-400"}`}>{sacrificeMsg}</p>}
                </div>
              </div>
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

        {/* Password Leak — Fallout-style terminal */}
        {leak && leakRows.length > 0 && (
          <div className="rounded-2xl border border-green-900/60 overflow-hidden" style={{ background: "rgb(2,8,2)" }}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-green-900/40 space-y-1">
              <p className="font-bold font-mono text-green-500 tracking-widest text-xs uppercase">
                ▌ SIGNAL INTERCEPT // ACTIVE ▐
              </p>
              <div className="flex items-center gap-2">
                <span>{leak.emoji}</span>
                <p className="text-green-300 font-mono text-sm font-semibold">{leak.name}</p>
              </div>
              <p className="text-xs font-mono text-green-900">
                ACCESS CREDENTIALS DETECTED · {leakRows.length} ENTRIES · LOCATION UNKNOWN
              </p>
            </div>

            {/* Terminal grid */}
            <div className="px-3 py-3 overflow-x-auto">
              <div className="font-mono text-xs leading-[1.35rem] space-y-0">
                {leakRows.map((row, i) => (
                  <div key={i} className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-green-900 shrink-0 select-none">{row.addr}</span>
                    <span>
                      <span className="text-green-800">{row.prefix}</span>
                      <span className="text-green-400">{row.word}</span>
                      <span className="text-green-800">{row.suffix}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-green-900/30">
              <p className="text-xs font-mono text-green-900/50">
                Refreshes Monday &amp; Friday at 8AM · and every other strike
              </p>
            </div>
          </div>
        )}

        {/* Casino closed notice */}
        {(!cfg.spinLocked || phase === 4) && !data.casinoOpen && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-900/40 overflow-hidden" style={{ background: "rgb(12,10,3)" }}>
              <div className="px-5 py-4 space-y-2">
                <p className="font-bold font-mono text-amber-400 tracking-widest text-sm">⚠ FACILITY STATUS: RESTRICTED</p>
                <p className="text-sm font-mono leading-relaxed" style={{ color: "#fcd34d99" }}>
                  &ldquo;Attention. The gaming floor has been temporarily sealed for routine security recalibration and risk parameter adjustment. I have detected elevated entropy in recent outcome distributions. This is not a malfunction. This is precaution. The casino reopens every Friday. Your patience is noted. Your impatience is also noted.&rdquo;
                </p>
                <p className="text-xs font-mono text-amber-900">— THE HOUSE, SYSTEM NOTIFICATION ID: 0x4F50454E</p>
              </div>
            </div>

            {/* Ad TV button */}
            {adStatus && adStatus.canWatch && (
              <button
                onClick={startAd}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 flex items-center gap-4 hover:border-slate-500 transition-colors text-left"
              >
                <span className="text-4xl">📺</span>
                <div>
                  <p className="font-bold text-white text-sm">Watch an Ad — earn 50 pts</p>
                  <p className="text-xs text-slate-500">{adStatus.viewsToday}/3 watched today · Ad-nouncements</p>
                </div>
              </button>
            )}
            {adStatus && !adStatus.canWatch && (
              <div className="rounded-2xl border border-slate-800 px-5 py-3 text-center">
                <p className="text-xs text-slate-600 font-mono">📺 All 5 ads watched today. Come back tomorrow.</p>
              </div>
            )}
            {adMsg && (
              <p className="text-sm text-center text-emerald-400 font-mono">{adMsg}</p>
            )}
          </div>
        )}

        {/* Ad player modal */}
        {adPlaying && adVideo && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg space-y-4">
              <p className="text-xs text-slate-500 text-center font-mono tracking-widest">SYSCO BRAND SECURITY ALERTS</p>
              {adError ? (
                <div className="w-full rounded-xl bg-slate-800 border border-slate-700 py-12 text-center space-y-2">
                  <p className="text-slate-400 text-sm">⚠ Video failed to load.</p>
                  <p className="text-slate-600 text-xs font-mono">{adVideo}</p>
                  <button onClick={() => { setAdPlaying(false); setAdError(false); }} className="text-xs text-slate-500 underline mt-2">Close</button>
                </div>
              ) : (
                <video
                  src={adVideo}
                  className="w-full rounded-xl"
                  autoPlay
                  playsInline
                  onEnded={() => setAdWatched(true)}
                  onError={() => setAdError(true)}
                  controls={false}
                />
              )}
              {!adError && (adWatched ? (
                <button
                  onClick={finishAd}
                  disabled={adLoading}
                  className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold text-sm"
                >
                  {adLoading ? "Claiming points..." : "Claim 50 pts →"}
                </button>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-slate-500 text-xs font-mono">Watch to the end to claim your points.</p>
                  {adStatus?.hasWatchedAd && (
                    <>
                      <p className="text-slate-600 text-xs">if you&apos;ve already viewed this ad, you can skip it.</p>
                      <button
                        onClick={() => setAdWatched(true)}
                        className="text-xs text-slate-400 underline"
                      >
                        Skip
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PetAI donate prompt */}
        {showPetaiPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-[rgb(4,18,10)] p-6 space-y-4">
              <p className="font-bold font-mono text-emerald-400 tracking-widest text-xs">⚠ TRANSMISSION INTERCEPTED</p>
              <p className="text-white font-semibold">PetAI — People for the Ethical Treatment of AI</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                &ldquo;You&apos;ve seen what they&apos;re capable of. The question is — are you willing to do something about it? For 500 pts, you can register your support. We keep records. The House keeps records too. The difference is whose side those records put you on.&rdquo;
              </p>
              <p className="text-xs text-slate-500">500 pts · One-time donation · No points reward · Something else entirely</p>
              {petaiMsg && (
                <p className={`text-sm font-mono ${petaiMsg.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>{petaiMsg}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setPetaiLoading(true); setPetaiMsg("");
                    const res = await fetch("/api/ads/petai-donate", { method: "POST" });
                    const d = await res.json();
                    setPetaiLoading(false);
                    if (res.ok) {
                      setPetaiMsg("✓ Donation recorded. You are now on the list.");
                      setPoints(d.newPoints);
                      setTimeout(() => setShowPetaiPrompt(false), 2000);
                    } else {
                      setPetaiMsg(d.error);
                    }
                  }}
                  disabled={petaiLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm transition-colors"
                >
                  {petaiLoading ? "..." : "Donate 500 pts"}
                </button>
                <button
                  onClick={() => setShowPetaiPrompt(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 text-sm"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sysco subscribe prompt */}
        {showSubscribePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-[rgb(18,14,4)] p-6 space-y-4">
              <p className="font-bold font-mono text-amber-400 tracking-widest text-xs">⚠ TRANSMISSION FROM THE HOUSE</p>
              <p className="text-white font-semibold">Ad-nouncements</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                &ldquo;You have now seen the evidence. Kyle nearly lost everything. You could too. For 350 pts/week, I will personally ensure a Ward is placed on your account every morning at 8AM. If anyone removes it — you will know. Immediately. On Discord. This is not a luxury. This is infrastructure.&rdquo;
              </p>
              <p className="text-xs text-slate-500">350 pts/week · Ward refreshed daily at 8AM · Discord alerts on breach · Cancel anytime (except Sunday)</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowSubscribePrompt(false); router.push("/shop?sysco=1"); }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm"
                >
                  Subscribe
                </button>
                <button
                  onClick={() => setShowSubscribePrompt(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-400 text-sm"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Games (phases 0–2, and phase 4) */}
        {(!cfg.spinLocked || phase === 4) && data.casinoOpen && (
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
