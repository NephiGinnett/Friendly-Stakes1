"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Upgrade config ────────────────────────────────────────────────────────────

const UPGRADES = {
  sled:   { label: "🛷 Sled",   desc: "Faster launch",     costs: [50, 150, 350, 750]  },
  ramp:   { label: "📐 Ramp",   desc: "Better angle",      costs: [100, 300, 700]      },
  rocket: { label: "🚀 Rocket", desc: "Mid-flight boost",  costs: [250, 750, 1500]     },
  glider: { label: "🪂 Glider", desc: "Slower fall",       costs: [500, 1200]          },
} as const;

type UpgradeKey = keyof typeof UPGRADES;
type Upgrades = Record<UpgradeKey, number>;

// ── localStorage ──────────────────────────────────────────────────────────────

type LocalState = { coinBank: number; upgrades: Upgrades; resetMonth: string };

const DEFAULT_UPGRADES: Upgrades = { sled: 0, ramp: 0, rocket: 0, glider: 0 };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadLocal(): LocalState {
  try {
    const raw = localStorage.getItem("gameState_learn-to-fly");
    if (!raw) return { coinBank: 0, upgrades: { ...DEFAULT_UPGRADES }, resetMonth: currentMonth() };
    const s = JSON.parse(raw) as LocalState;
    if (s.resetMonth !== currentMonth()) {
      const fresh: LocalState = { coinBank: 0, upgrades: { ...DEFAULT_UPGRADES }, resetMonth: currentMonth() };
      localStorage.setItem("gameState_learn-to-fly", JSON.stringify(fresh));
      return fresh;
    }
    return s;
  } catch {
    return { coinBank: 0, upgrades: { ...DEFAULT_UPGRADES }, resetMonth: currentMonth() };
  }
}

function saveLocal(s: LocalState) {
  try { localStorage.setItem("gameState_learn-to-fly", JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Physics ───────────────────────────────────────────────────────────────────

type FlightPoint = { x: number; y: number };

function simulateFlight(upgrades: Upgrades, power: number): { distance: number; path: FlightPoint[] } {
  const g = 0.04 - upgrades.glider * 0.008;
  const baseSpeed = 15;
  const speedMult = (0.5 + power * 0.5) * (1 + upgrades.sled * 0.25);
  const speed = baseSpeed * speedMult;
  const angle = (30 + upgrades.ramp * 5) * (Math.PI / 180);

  let vx = speed * Math.cos(angle);
  let vy = speed * Math.sin(angle);
  let x = 0;
  let y = 0;
  let rocketFired = false;
  const path: FlightPoint[] = [{ x: 0, y: 0 }];

  for (let i = 0; i < 20000; i++) {
    vy -= g;
    x += vx;
    y += vy;

    if (!rocketFired && vy <= 0) {
      rocketFired = true;
      vx += upgrades.rocket * 3;
      vy += upgrades.rocket * 2;
    }

    path.push({ x, y });
    if (y < 0 && i > 5) break;
  }

  return { distance: Math.max(0, Math.floor(x)), path };
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type GameOverPayload = {
  coinsEarned: number;
  distance: number;
  metadata?: Record<string, unknown>;
};

type Props = { onGameOver: (payload: GameOverPayload) => void };
type Phase = "shop" | "launching" | "flying" | "landed";

// ── Canvas helpers ────────────────────────────────────────────────────────────

const W = 400;
const H = 200;
const PAD = 20;
const WATER_H = 18;

function drawScene(
  ctx: CanvasRenderingContext2D,
  path: FlightPoint[],
  frame: number
) {
  const maxX = path[path.length - 1].x || 1;
  const maxY = Math.max(...path.map((p) => p.y), 10);
  const sx = (W - PAD * 2) / maxX;
  const sy = (H - PAD - WATER_H) / maxY;

  const cx = (p: FlightPoint) => PAD + p.x * sx;
  const cy = (p: FlightPoint) => H - WATER_H - p.y * sy;

  ctx.clearRect(0, 0, W, H);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0f172a");
  sky.addColorStop(1, "#1e3a5f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Water
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(0, H - WATER_H, W, WATER_H);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(0, H - WATER_H, W, 3);

  // Trail
  const trailStart = Math.max(0, frame - 100);
  if (trailStart < frame) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(139,92,246,0.55)";
    ctx.lineWidth = 1.5;
    for (let i = trailStart; i <= Math.min(frame, path.length - 1); i++) {
      const p = path[i];
      i === trailStart ? ctx.moveTo(cx(p), cy(p)) : ctx.lineTo(cx(p), cy(p));
    }
    ctx.stroke();
  }

  // Penguin
  const pt = path[Math.min(frame, path.length - 1)];
  ctx.font = "16px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🐧", cx(pt), cy(pt));

  // Distance label
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${Math.floor(pt.x)}m`, PAD, 6);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LearnToFly({ onGameOver }: Props) {
  const [local, setLocal] = useState<LocalState>({
    coinBank: 0,
    upgrades: { ...DEFAULT_UPGRADES },
    resetMonth: currentMonth(),
  });
  const [phase, setPhase] = useState<Phase>("shop");
  const [power, setPower] = useState(0);
  const [result, setResult] = useState<{ distance: number; coinsEarned: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pathRef = useRef<FlightPoint[]>([]);
  const powerRef = useRef(0);

  useEffect(() => { setLocal(loadLocal()); }, []);

  // Power bar
  useEffect(() => {
    if (phase !== "launching") return;
    const id = setInterval(() => {
      setPower((p) => {
        const next = Math.min(100, p + 2);
        powerRef.current = next;
        return next;
      });
    }, 30);
    return () => clearInterval(id);
  }, [phase]);

  // Canvas animation
  useEffect(() => {
    if (phase !== "flying") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const path = pathRef.current;
    const total = path.length;
    const step = Math.max(1, Math.floor(total / 90)); // ~90 draw calls
    let frame = 0;

    const tick = () => {
      drawScene(ctx, path, frame);
      if (frame < total - 1) {
        frame = Math.min(frame + step, total - 1);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase("landed");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  const buyUpgrade = (key: UpgradeKey) => {
    const level = local.upgrades[key];
    const costs = UPGRADES[key].costs as readonly number[];
    if (level >= costs.length) return;
    const cost = costs[level];
    if (local.coinBank < cost) return;
    const next: LocalState = {
      ...local,
      coinBank: local.coinBank - cost,
      upgrades: { ...local.upgrades, [key]: level + 1 },
    };
    setLocal(next);
    saveLocal(next);
  };

  const doLaunch = useCallback(() => {
    const p = powerRef.current / 100;
    const { distance, path } = simulateFlight(local.upgrades, p);
    const coinsEarned = Math.floor(distance / 80);
    pathRef.current = path;

    const next: LocalState = {
      ...local,
      coinBank: local.coinBank + coinsEarned,
    };
    setLocal(next);
    saveLocal(next);
    setResult({ distance, coinsEarned });
    setPhase("flying");
  }, [local]);

  const handleContinue = () => {
    if (!result) return;
    onGameOver({
      coinsEarned: result.coinsEarned,
      distance: result.distance,
      metadata: { distance: result.distance, upgrades: local.upgrades },
    });
  };

  // Days until monthly reset
  const daysLeft = (() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return lastDay - d.getDate();
  })();

  // ── Shop ──────────────────────────────────────────────────────────────────

  if (phase === "shop") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
          <span className="text-yellow-400 font-bold text-lg">🪙 {local.coinBank.toLocaleString()}</span>
          <span className="text-slate-500 text-xs">resets in {daysLeft}d</span>
        </div>

        <div className="space-y-2">
          {(Object.keys(UPGRADES) as UpgradeKey[]).map((key) => {
            const cfg = UPGRADES[key];
            const level = local.upgrades[key];
            const maxLevel = cfg.costs.length;
            const cost = level < maxLevel ? (cfg.costs as readonly number[])[level] : null;
            const canAfford = cost !== null && local.coinBank >= cost;

            return (
              <div
                key={key}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm">{cfg.label}</div>
                  <div className="text-slate-500 text-xs">{cfg.desc}</div>
                  <div className="flex gap-1 mt-1.5">
                    {Array.from({ length: maxLevel }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full ${i < level ? "bg-violet-500" : "bg-white/15"}`}
                      />
                    ))}
                  </div>
                </div>
                {cost !== null ? (
                  <button
                    onClick={() => buyUpgrade(key)}
                    disabled={!canAfford}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      canAfford
                        ? "bg-violet-600 hover:bg-violet-500 text-white"
                        : "bg-white/8 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    🪙 {cost}
                  </button>
                ) : (
                  <span className="shrink-0 text-green-400 text-xs font-semibold px-2">MAX</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { setPower(0); powerRef.current = 0; setPhase("launching"); }}
          className="w-full py-4 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold text-base rounded-xl transition-colors"
        >
          Launch! 🐧
        </button>
      </div>
    );
  }

  // ── Power meter ───────────────────────────────────────────────────────────

  if (phase === "launching") {
    const barColor =
      power < 50 ? "from-blue-500 to-cyan-400" :
      power < 80 ? "from-violet-500 to-pink-400" :
                   "from-yellow-400 to-orange-400";

    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="text-5xl select-none">🐧</div>
        <p className="text-slate-400 text-sm">Tap LAUNCH at full power!</p>

        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Power</span>
            <span className={power === 100 ? "text-yellow-400 font-bold animate-pulse" : ""}>{power}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${barColor} transition-none rounded-full`}
              style={{ width: `${power}%` }}
            />
          </div>
        </div>

        {power === 100 && (
          <p className="text-yellow-400 text-sm font-bold animate-pulse">⚡ FULL POWER!</p>
        )}

        <button
          onClick={doLaunch}
          className="w-full py-4 bg-green-500 hover:bg-green-400 active:bg-green-600 text-white font-bold text-lg rounded-xl transition-colors"
        >
          🚀 LAUNCH!
        </button>
      </div>
    );
  }

  // ── Flying + Landed ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {phase === "flying" && (
        <p className="text-center text-slate-500 text-sm animate-pulse">Flying…</p>
      )}

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-xl border border-white/10"
      />

      {phase === "landed" && result && (
        <>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Distance</span>
              <span className="text-white font-semibold">{result.distance.toLocaleString()}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Coins earned</span>
              <span className="text-yellow-400 font-semibold">+🪙 {result.coinsEarned}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2">
              <span className="text-slate-400">Coin bank</span>
              <span className="text-yellow-400">🪙 {local.coinBank.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-colors"
          >
            Continue →
          </button>
        </>
      )}
    </div>
  );
}
