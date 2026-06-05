"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Re-exported for other game components ─────────────────────────────────────
export type GameOverPayload = {
  coinsEarned: number;
  distance: number;
  metadata?: Record<string, unknown>;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const GRAVITY = 0.18;
const GROUND_Y = 520;
const LAUNCH_X = 80;
const CW = 700;
const CH = 560;

// ── Upgrade definitions ────────────────────────────────────────────────────────

type RampLevel  = { name: string; cost: number; angle: number; color: string };
type SledLevel  = { name: string; cost: number; speed: number; color: string };
type GliderLevel= { name: string; cost: number; drag:  number; color: string };
type RocketLevel= { name: string; cost: number; thrust: number; fuel: number };
type BounceLevel= { name: string; cost: number; bounces: number; restitution: number };

const UPGRADES: {
  ramp:   { label: string; icon: string; desc: string; levels: RampLevel[]  };
  sled:   { label: string; icon: string; desc: string; levels: SledLevel[]  };
  glider: { label: string; icon: string; desc: string; levels: GliderLevel[]};
  rocket: { label: string; icon: string; desc: string; levels: RocketLevel[]};
  bounce: { label: string; icon: string; desc: string; levels: BounceLevel[]};
} = {
  ramp: {
    label: "Launch Ramp", icon: "📐", desc: "Steeper ramp = more launch angle",
    levels: [
      { name: "Dirt Mound",  cost: 0,    angle: 28, color: "#8B6914" },
      { name: "Wooden Ramp", cost: 80,   angle: 36, color: "#A0522D" },
      { name: "Steel Ramp",  cost: 250,  angle: 42, color: "#708090" },
      { name: "Rocket Ramp", cost: 600,  angle: 48, color: "#FF4500" },
      { name: "Orbital Pad", cost: 2500, angle: 55, color: "#00CED1" },
    ],
  },
  sled: {
    label: "Sled", icon: "🛷", desc: "Better sled = higher launch speed",
    levels: [
      { name: "Cardboard Box", cost: 0,    speed: 7,  color: "#DEB887" },
      { name: "Wooden Sled",   cost: 100,  speed: 9,  color: "#8B4513" },
      { name: "Plastic Sled",  cost: 280,  speed: 11, color: "#1E90FF" },
      { name: "Metal Sled",    cost: 700,  speed: 13, color: "#C0C0C0" },
      { name: "Rocket Sled",   cost: 3000, speed: 16, color: "#FF6347" },
    ],
  },
  glider: {
    label: "Glider", icon: "🪂", desc: "Better glider reduces drag",
    levels: [
      { name: "No Glider",   cost: 0,    drag: 0.0045, color: "#999"    },
      { name: "Paper Wings", cost: 120,  drag: 0.0028, color: "#FFFACD" },
      { name: "Hang Glider", cost: 350,  drag: 0.0015, color: "#32CD32" },
      { name: "Paraglider",  cost: 900,  drag: 0.0007, color: "#FF69B4" },
      { name: "Wingsuit",    cost: 3500, drag: 0.0002, color: "#7B68EE" },
    ],
  },
  rocket: {
    label: "Booster", icon: "🚀", desc: "Mid-air thrust boost",
    levels: [
      { name: "None",          cost: 0,    thrust: 0,   fuel: 0   },
      { name: "Bottle Rocket", cost: 200,  thrust: 0.3, fuel: 60  },
      { name: "Firework",      cost: 500,  thrust: 0.6, fuel: 90  },
      { name: "Jet Engine",    cost: 2200, thrust: 1.1, fuel: 120 },
      { name: "Ion Thruster",  cost: 7500, thrust: 1.8, fuel: 200 },
    ],
  },
  bounce: {
    label: "Bounce Pads", icon: "🟡", desc: "Bounce off the ground to keep going!",
    levels: [
      { name: "None",          cost: 0,    bounces: 0, restitution: 0    },
      { name: "Rubber Tummy",  cost: 150,  bounces: 1, restitution: 0.45 },
      { name: "Spring Belly",  cost: 400,  bounces: 2, restitution: 0.55 },
      { name: "Bumper Body",   cost: 1000, bounces: 3, restitution: 0.65 },
      { name: "Super Bouncer", cost: 4000, bounces: 5, restitution: 0.72 },
    ],
  },
};

const UPGRADE_KEYS = ["ramp", "sled", "glider", "rocket", "bounce"] as const;
type UpgradeKey = typeof UPGRADE_KEYS[number];
type UpgradeLevels = Record<UpgradeKey, number>;
type Screen = "menu" | "flying" | "shop";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Star     = { x: number; y: number; r: number; a: number };
type Cloud    = { x: number; y: number; w: number; h: number; speed: number };

type GameState = {
  x: number; y: number; vx: number; vy: number;
  drag: number; thrust: number; fuel: number; maxFuel: number;
  bouncesLeft: number; maxBounces: number; restitution: number;
  boosting: boolean; landed: boolean; dist: number; cameraX: number;
  particles: Particle[]; stars: Star[]; clouds: Cloud[];
  levels: UpgradeLevels;
};

// ── localStorage ───────────────────────────────────────────────────────────────
const LS_KEY = "gameState_learn-to-fly";
const DEFAULT_UPGRADES: UpgradeLevels = { ramp: 0, sled: 0, glider: 0, rocket: 0, bounce: 0 };

type LocalState = { coinBank: number; upgrades: UpgradeLevels; resetMonth: string; bestDist: number };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadLocal(): LocalState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { coinBank: 0, upgrades: { ...DEFAULT_UPGRADES }, resetMonth: currentMonth(), bestDist: 0 };
    const s = JSON.parse(raw) as Partial<LocalState & { upgrades: Partial<UpgradeLevels> }>;
    if (s.resetMonth !== currentMonth()) {
      const fresh: LocalState = { coinBank: 0, upgrades: { ...DEFAULT_UPGRADES }, resetMonth: currentMonth(), bestDist: 0 };
      localStorage.setItem(LS_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return {
      coinBank:   s.coinBank   ?? 0,
      upgrades:   { ...DEFAULT_UPGRADES, ...(s.upgrades ?? {}) },
      resetMonth: s.resetMonth ?? currentMonth(),
      bestDist:   s.bestDist   ?? 0,
    };
  } catch {
    return { coinBank: 0, upgrades: { ...DEFAULT_UPGRADES }, resetMonth: currentMonth(), bestDist: 0 };
  }
}

function saveLocal(s: LocalState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toRad(deg: number) { return deg * Math.PI / 180; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function fmtDist(px: number) {
  const m = Math.round(px / 5);
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`;
}

// Rounded rect path helper (avoids potential ctx.roundRect TS availability issues)
function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r,     y,     r);
  ctx.closePath();
}

// ── Draw (module-level so RAF closure doesn't recreate) ────────────────────────
function drawScene(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.clearRect(0, 0, CW, CH);

  // Sky gradient
  const hf = Math.max(0, Math.min(1, (GROUND_Y - s.y) / 400));
  const skyTop = `hsl(${lerp(200, 220, hf)},${lerp(60, 90, hf)}%,${lerp(75, 30, hf)}%)`;
  const skyBot = `hsl(${lerp(190, 210, hf)},${lerp(50, 80, hf)}%,${lerp(88, 55, hf)}%)`;
  const grad = ctx.createLinearGradient(0, 0, 0, CH);
  grad.addColorStop(0, skyTop);
  grad.addColorStop(1, skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, CH);

  // Stars
  if (hf > 0.3) {
    ctx.save();
    ctx.globalAlpha = (hf - 0.3) * 1.4;
    for (const st of s.stars) {
      const sx = ((st.x - s.cameraX * 0.3) % CW + CW) % CW;
      ctx.beginPath();
      ctx.arc(sx, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${st.a})`;
      ctx.fill();
    }
    ctx.restore();
  }

  // Clouds
  ctx.save();
  ctx.globalAlpha = Math.max(0.1, 1 - hf * 1.5);
  for (const cl of s.clouds) {
    const cx = ((cl.x - s.cameraX * 0.4) % (CW + 200) + CW + 200) % (CW + 200) - 100;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.ellipse(cx,                cl.y,      cl.w,        cl.h,        0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - cl.w * 0.4,  cl.y + 5,  cl.w * 0.6,  cl.h * 0.8,  0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + cl.w * 0.4,  cl.y + 8,  cl.w * 0.7,  cl.h * 0.7,  0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Distance markers
  ctx.save();
  for (let m = 0; m < 20000; m += 500) {
    const mx = m - s.cameraX;
    if (mx < -50 || mx > CW + 50) continue;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, CH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px monospace";
    ctx.fillText(fmtDist(m), mx + 4, GROUND_Y - 5);
  }
  ctx.restore();

  // Ground
  const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CH);
  groundGrad.addColorStop(0, "#3a7d44");
  groundGrad.addColorStop(0.15, "#2d6a3a");
  groundGrad.addColorStop(1, "#1a3d22");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);

  // Snow caps
  for (let i = 1; i <= 5; i++) {
    const mx = i * 1200 - s.cameraX;
    if (mx < -200 || mx > CW + 200) continue;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(mx - 40, GROUND_Y);
    ctx.lineTo(mx, GROUND_Y - 60);
    ctx.lineTo(mx + 40, GROUND_Y);
    ctx.fill();
  }

  // Ramp
  const rampData = UPGRADES.ramp.levels[s.levels.ramp];
  const rampX = LAUNCH_X - s.cameraX;
  const angle = toRad(rampData.angle);
  ctx.save();
  ctx.strokeStyle = rampData.color;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rampX - 20, GROUND_Y);
  ctx.lineTo(rampX + Math.cos(angle) * 80, GROUND_Y - Math.sin(angle) * 80);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(rampX - 20, GROUND_Y); ctx.lineTo(rampX, GROUND_Y); ctx.stroke();
  ctx.restore();

  // Particles
  for (const p of s.particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - s.cameraX, p.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Player
  const px = s.x - s.cameraX;
  const py = s.y;
  const gliderData = UPGRADES.glider.levels[s.levels.glider];
  const sledData   = UPGRADES.sled.levels[s.levels.sled];

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(s.landed ? 0 : Math.atan2(s.vy, s.vx));

  // Glider wings
  if (s.levels.glider > 0 && !s.landed) {
    ctx.fillStyle = gliderData.color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-50, -20); ctx.lineTo(-40, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(50,  -20); ctx.lineTo(40,  0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Sled
  ctx.fillStyle = sledData.color;
  ctx.beginPath(); rrPath(ctx, -18, -6, 36, 10, 4); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.stroke();

  // Penguin body
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.ellipse(0, -16, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.ellipse(0, -15, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-4, -22, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 4, -22, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.arc(-3.5, -22, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 4.5, -22, 1.5, 0, Math.PI * 2); ctx.fill();
  // Beak
  ctx.fillStyle = "#FF8C00";
  ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(5, -17); ctx.lineTo(0, -15); ctx.closePath(); ctx.fill();

  // Rocket flame
  if (s.boosting && s.fuel > 0) {
    ctx.globalAlpha = 0.9;
    const fg = ctx.createRadialGradient(-20, 0, 0, -20, 0, 20);
    fg.addColorStop(0, "#FFF"); fg.addColorStop(0.3, "#FF0"); fg.addColorStop(1, "rgba(255,50,0,0)");
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.ellipse(-28, 0, 16 + Math.random() * 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();

  // HUD
  drawHUD(ctx, s);
}

function drawHUD(ctx: CanvasRenderingContext2D, s: GameState) {
  // Distance pill
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); rrPath(ctx, CW / 2 - 90, 12, 180, 40, 8); ctx.fill();
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 22px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText(fmtDist(s.dist), CW / 2, 39);
  ctx.restore();

  // Fuel bar
  if (s.levels.rocket > 0 && s.maxFuel > 0) {
    const bx = CW - 140, by = 16, bw = 120, bh = 14;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); rrPath(ctx, bx - 4, by - 4, bw + 8, bh + 24, 6); ctx.fill();
    ctx.fillStyle = "#333"; ctx.beginPath(); rrPath(ctx, bx, by, bw, bh, 4); ctx.fill();
    const frac = s.fuel / s.maxFuel;
    ctx.fillStyle = frac > 0.5 ? "#00FF7F" : frac > 0.2 ? "#FFD700" : "#FF4500";
    ctx.beginPath(); rrPath(ctx, bx, by, bw * frac, bh, 4); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.textAlign = "left";
    ctx.fillText("🚀 FUEL", bx, by + bh + 14);
    ctx.restore();
  }

  // Bounce dots
  if (s.maxBounces > 0) {
    const bx = 16, by = 16;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); rrPath(ctx, bx - 4, by - 4, 100, 36, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.textAlign = "left";
    ctx.fillText("🟡 BOUNCES", bx, by + 10);
    for (let i = 0; i < s.maxBounces; i++) {
      ctx.fillStyle = i < s.bouncesLeft ? "#FFD700" : "#333";
      ctx.beginPath(); ctx.arc(bx + 8 + i * 18, by + 22, 6, 0, Math.PI * 2); ctx.fill();
      if (i < s.bouncesLeft) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.restore();
  }

  // Boost hint
  if (!s.landed && s.fuel > 0 && !s.boosting) {
    ctx.save();
    ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 300) * 0.3;
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("HOLD SPACE / TAP to BOOST", CW / 2, GROUND_Y - 30);
    ctx.restore();
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
type Props = { onGameOver: (payload: GameOverPayload) => void };

export default function LearnToFly({ onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<GameState | null>(null);
  const animRef   = useRef<number>(0);
  const onGameOverRef = useRef(onGameOver);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  const [screen, setScreen] = useState<Screen>("menu");
  const [coins, setCoins]   = useState(0);
  const [upgradeLevels, setUpgradeLevels] = useState<UpgradeLevels>({ ...DEFAULT_UPGRADES });
  const [bestDist, setBestDist] = useState(0);
  const [shopMsg, setShopMsg]   = useState("");
  const [liveDist, setLiveDist] = useState(0);
  const [boostActive, setBoostActive] = useState(false);

  // Mutable refs so the RAF loop always sees current values
  const coinsRef    = useRef(0);
  const upgradesRef = useRef<UpgradeLevels>({ ...DEFAULT_UPGRADES });
  const bestDistRef = useRef(0);

  // Load localStorage on mount
  useEffect(() => {
    const local = loadLocal();
    coinsRef.current    = local.coinBank;
    upgradesRef.current = local.upgrades;
    bestDistRef.current = local.bestDist;
    setCoins(local.coinBank);
    setUpgradeLevels(local.upgrades);
    setBestDist(local.bestDist);
  }, []);

  const startFlight = useCallback(() => {
    const levels = upgradesRef.current;
    const ramp   = UPGRADES.ramp.levels[levels.ramp];
    const sled   = UPGRADES.sled.levels[levels.sled];
    const glider = UPGRADES.glider.levels[levels.glider];
    const rocket = UPGRADES.rocket.levels[levels.rocket];
    const bounce = UPGRADES.bounce.levels[levels.bounce];
    const angle  = toRad(ramp.angle);

    stateRef.current = {
      x: LAUNCH_X, y: GROUND_Y - 10,
      vx: Math.cos(angle) * sled.speed,
      vy: -Math.sin(angle) * sled.speed,
      drag: glider.drag,
      thrust: rocket.thrust,
      fuel: rocket.fuel, maxFuel: rocket.fuel,
      bouncesLeft: bounce.bounces, maxBounces: bounce.bounces, restitution: bounce.restitution,
      boosting: false, landed: false, dist: 0, cameraX: 0,
      particles: [],
      stars:  Array.from({ length: 80 }, () => ({
        x: Math.random() * 4000, y: Math.random() * 300,
        r: Math.random() * 1.5 + 0.5, a: Math.random(),
      })),
      clouds: Array.from({ length: 12 }, (_, i) => ({
        x: i * 300 + 100, y: Math.random() * 200 + 30,
        w: Math.random() * 80 + 60, h: Math.random() * 30 + 20,
        speed: Math.random() * 0.2 + 0.1,
      })),
      levels,
    };
    setLiveDist(0);
    setBoostActive(false);
    setScreen("flying");
  }, []);

  // ── Input ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "flying") return;
    const boost = (on: boolean) => {
      const s = stateRef.current;
      if (s && !s.landed && s.fuel > 0) s.boosting = on;
    };
    const onKey  = (e: KeyboardEvent)  => { if (e.code === "Space") { e.preventDefault(); boost(true);  } };
    const onKeyU = (e: KeyboardEvent)  => { if (e.code === "Space") boost(false); };
    const onT    = ()                  => boost(true);
    const onTU   = ()                  => { const s = stateRef.current; if (s) s.boosting = false; };
    window.addEventListener("keydown",   onKey);
    window.addEventListener("keyup",     onKeyU);
    window.addEventListener("touchstart", onT,  { passive: true });
    window.addEventListener("touchend",   onTU, { passive: true });
    return () => {
      window.removeEventListener("keydown",   onKey);
      window.removeEventListener("keyup",     onKeyU);
      window.removeEventListener("touchstart", onT);
      window.removeEventListener("touchend",   onTU);
    };
  }, [screen]);

  // ── Game Loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "flying") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      const s = stateRef.current;
      if (!s) return;

      if (!s.landed) {
        s.vy += GRAVITY;

        if (s.boosting && s.fuel > 0) {
          const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
          if (spd > 0) { s.vx += (s.vx / spd) * s.thrust; s.vy += (s.vy / spd) * s.thrust; }
          s.fuel -= 1;
          for (let i = 0; i < 3; i++) {
            s.particles.push({
              x: s.x, y: s.y,
              vx: -s.vx * 0.3 + (Math.random() - 0.5) * 2,
              vy: -s.vy * 0.3 + (Math.random() - 0.5) * 2,
              life: 1, color: `hsl(${20 + Math.random() * 40},100%,60%)`,
            });
          }
        }

        s.vx *= (1 - s.drag);
        s.vy *= (1 - s.drag * 0.5);
        s.x  += s.vx;
        s.y  += s.vy;
        s.dist = Math.max(s.dist, s.x - LAUNCH_X);

        if (s.y >= GROUND_Y) {
          s.y = GROUND_Y;
          if (s.bouncesLeft > 0 && Math.abs(s.vy) > 1.5) {
            s.vy = -Math.abs(s.vy) * s.restitution;
            s.vx *= 0.85;
            s.bouncesLeft -= 1;
            for (let i = 0; i < 8; i++) {
              s.particles.push({
                x: s.x, y: s.y,
                vx: (Math.random() - 0.5) * 6,
                vy: -(Math.random() * 4 + 1),
                life: 1, color: `hsl(${45 + Math.random() * 30},100%,60%)`,
              });
            }
          } else {
            s.landed = true;
          }
        }

        s.cameraX = Math.max(0, s.x - 200);
      }

      s.particles = s.particles
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.04 }))
        .filter(p => p.life > 0);

      setBoostActive(s.boosting && s.fuel > 0);
      setLiveDist(Math.round(s.dist / 5));

      drawScene(ctx, s);

      if (s.landed) {
        const distPx = s.dist;
        const distM  = Math.round(distPx / 5);
        const earned = Math.round(distPx / 8);

        coinsRef.current += earned;
        if (distM > bestDistRef.current) bestDistRef.current = distM;

        setCoins(coinsRef.current);
        setBestDist(bestDistRef.current);

        saveLocal({
          coinBank:   coinsRef.current,
          upgrades:   upgradesRef.current,
          resetMonth: currentMonth(),
          bestDist:   bestDistRef.current,
        });

        setTimeout(() => {
          onGameOverRef.current({
            coinsEarned: earned,
            distance:    distM,
            metadata:    { distance: distM, upgrades: upgradesRef.current },
          });
        }, 600);
        return;
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [screen]);

  // ── Buy upgrade ────────────────────────────────────────────────────────────
  const buyUpgrade = useCallback((key: UpgradeKey) => {
    const current = upgradesRef.current[key];
    const next    = current + 1;
    if (next >= UPGRADES[key].levels.length) {
      setShopMsg("Already maxed out!"); setTimeout(() => setShopMsg(""), 1500); return;
    }
    const cost = UPGRADES[key].levels[next].cost;
    if (coinsRef.current < cost) {
      setShopMsg(`Need ${cost - coinsRef.current} more coins!`); setTimeout(() => setShopMsg(""), 1500); return;
    }
    coinsRef.current -= cost;
    upgradesRef.current = { ...upgradesRef.current, [key]: next };
    setCoins(coinsRef.current);
    setUpgradeLevels({ ...upgradesRef.current });
    saveLocal({ coinBank: coinsRef.current, upgrades: upgradesRef.current, resetMonth: currentMonth(), bestDist: bestDistRef.current });
    setShopMsg(`✅ Upgraded to ${UPGRADES[key].levels[next].name}!`);
    setTimeout(() => setShopMsg(""), 1500);
  }, []);

  // Days until monthly reset
  const daysLeft = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
  })();

  // ── Flying screen ──────────────────────────────────────────────────────────
  if (screen === "flying") {
    return (
      <div style={{ background: "#000", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", fontFamily: "monospace", padding: "8px 0" }}>
        <canvas
          ref={canvasRef} width={CW} height={CH}
          style={{ border: "3px solid #FFD700", borderRadius: 8, display: "block",
            maxWidth: "100%", cursor: "pointer", touchAction: "none" }}
          onMouseDown={() => { const s = stateRef.current; if (s && !s.landed && s.fuel > 0) s.boosting = true; }}
          onMouseUp={()   => { const s = stateRef.current; if (s) s.boosting = false; }}
        />
        <div style={{ color: "#FFD700", marginTop: 8, fontSize: 13 }}>
          {boostActive ? "🔥 BOOSTING!" : `${fmtDist(liveDist * 5)} · HOLD SPACE or CLICK to boost`}
        </div>
      </div>
    );
  }

  // ── Shop ────────────────────────────────────────────────────────────────────
  if (screen === "shop") {
    return (
      <div style={S.screen}>
        <div style={{ ...S.panel, maxWidth: 520, width: "95%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ ...S.title, margin: 0, fontSize: 22 }}>⚙️ Upgrade Shop</h2>
            <div style={{ color: "#FFD700", fontSize: 16, fontWeight: "bold" }}>
              🪙 {coins.toLocaleString()}
              <span style={{ color: "#555", fontSize: 11, marginLeft: 8 }}>resets in {daysLeft}d</span>
            </div>
          </div>

          {shopMsg && (
            <div style={{ background: "#2a2a2a", color: "#FFD700", padding: "8px 14px",
              borderRadius: 6, marginBottom: 12, textAlign: "center", fontSize: 13 }}>
              {shopMsg}
            </div>
          )}

          {UPGRADE_KEYS.map(key => {
            const upg     = UPGRADES[key];
            const level   = upgradeLevels[key];
            const current = upg.levels[level];
            const next    = upg.levels[level + 1];
            const maxed   = level >= upg.levels.length - 1;
            return (
              <div key={key} style={S.upgradeCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{upg.icon}</span>
                      <span style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>{upg.label}</span>
                    </div>
                    <div style={{ color: "#aaa", fontSize: 11, marginBottom: 6 }}>{upg.desc}</div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {upg.levels.map((_, i) => (
                        <div key={i} style={{
                          width: 14, height: 7, borderRadius: 2,
                          background: i <= level ? "#FFD700" : "#333",
                          border: `1px solid ${i === level ? "#fff" : "#555"}`,
                        }} />
                      ))}
                    </div>
                    <div style={{ color: "#ccc", fontSize: 11, marginTop: 5 }}>
                      Current: <span style={{ color: "#FFD700" }}>{current.name}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {!maxed && next ? (
                      <>
                        <div style={{ color: "#aaa", fontSize: 10, marginBottom: 4 }}>→ {next.name}</div>
                        <button
                          onClick={() => buyUpgrade(key)}
                          style={{
                            ...S.btn, padding: "5px 12px", fontSize: 12,
                            background:   coins >= next.cost ? "#1a3a1a" : "#2a1a1a",
                            borderColor:  coins >= next.cost ? "#00FF7F" : "#FF4500",
                            color:        coins >= next.cost ? "#00FF7F" : "#FF4500",
                          }}
                        >
                          🪙 {next.cost.toLocaleString()}
                        </button>
                      </>
                    ) : (
                      <div style={{ color: "#FFD700", fontSize: 11, padding: "5px 8px",
                        background: "#2a2a00", borderRadius: 6, border: "1px solid #FFD700" }}>
                        ⭐ MAXED
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button style={S.btn} onClick={startFlight}>🚀 Launch!</button>
            <button style={{ ...S.btn, background: "#1a1a2a" }} onClick={() => setScreen("menu")}>← Menu</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Menu ────────────────────────────────────────────────────────────────────
  return (
    <div style={S.screen}>
      <div style={S.panel}>
        <div style={{ fontSize: 56, marginBottom: 4, filter: "drop-shadow(0 4px 12px #0008)" }}>🐧</div>
        <h1 style={{ ...S.title, fontSize: 30, letterSpacing: 3, marginBottom: 4 }}>LEARN TO FLY</h1>
        <div style={{ color: "#aaa", fontSize: 12, marginBottom: 20, letterSpacing: 1 }}>
          A penguin&apos;s journey to defy gravity
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 16, fontSize: 13 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#00FF7F", fontWeight: "bold", fontSize: 16 }}>
              {bestDist >= 1000 ? `${(bestDist / 1000).toFixed(2)} km` : `${bestDist} m`}
            </div>
            <div style={{ color: "#555", fontSize: 10 }}>BEST</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: 16 }}>🪙 {coins.toLocaleString()}</div>
            <div style={{ color: "#555", fontSize: 10 }}>COINS · resets {daysLeft}d</div>
          </div>
        </div>

        <button style={{ ...S.btn, width: "100%", padding: "13px 0", fontSize: 17, marginBottom: 10 }}
          onClick={startFlight}>
          🚀 LAUNCH!
        </button>
        <button style={{ ...S.btn, width: "100%", padding: "9px 0", fontSize: 14, background: "#1a2a3a" }}
          onClick={() => setScreen("shop")}>
          🛒 Upgrades
        </button>

        <div style={{ marginTop: 18, color: "#444", fontSize: 10, lineHeight: 1.8 }}>
          SPACE · CLICK · TAP to boost mid-air<br />
          Earn coins per meter · Buy upgrades · Fly further
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  screen: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #0a0e1a 0%, #0d1f0d 50%, #0a0e1a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Courier New', monospace",
    padding: 16,
  } as React.CSSProperties,
  panel: {
    background: "rgba(15,20,30,0.95)",
    border: "2px solid #FFD700",
    borderRadius: 16,
    padding: "24px 28px",
    maxWidth: 400,
    width: "100%",
    boxShadow: "0 0 40px rgba(255,215,0,0.15), 0 20px 60px #000",
    textAlign: "center",
  } as React.CSSProperties,
  title: {
    color: "#FFD700",
    fontFamily: "'Courier New', monospace",
    fontWeight: "bold",
    margin: 0,
    textShadow: "0 0 20px rgba(255,215,0,0.5)",
  } as React.CSSProperties,
  btn: {
    background: "#1a3a1a",
    border: "2px solid #FFD700",
    color: "#FFD700",
    padding: "9px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    fontWeight: "bold",
    fontSize: 13,
    letterSpacing: 1,
  } as React.CSSProperties,
  upgradeCard: {
    background: "#111820",
    border: "1px solid #2a3a4a",
    borderRadius: 10,
    padding: "11px 13px",
    marginBottom: 8,
    textAlign: "left",
  } as React.CSSProperties,
};
