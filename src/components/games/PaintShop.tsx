"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { GameOverPayload } from "./types";

const TILE = 48;
const COLS = 16;
const ROWS = 14;
const W = COLS * TILE;
const H = ROWS * TILE;
const SPEED = 3.5;
const SHAKE_DURATION = 5;
const TIME_BONUS_MAX = 60;
const DAY_DURATION = 180;

type RGB = { r: number; g: number; b: number };
type Order = RGB & { name: string };
type ZoneKey = "counter" | "shelf" | "tinter" | "shaker" | "colorcheck" | "mistint";
type GamePhase =
  | "idle" | "got_order" | "has_paint" | "tinting" | "tinted"
  | "shaking" | "shaken" | "cashing_out" | "result";
type OrderResult = { score: number; pay: number; base: number; mult: number; dist: number; elapsed: number };
type HistoryItem = { name: string; score: number; pay: number; elapsed: number };

const ZONES: Record<ZoneKey, { x: number; y: number; w: number; h: number }> = {
  counter:    { x: 5,  y: 1,  w: 6, h: 2 },
  shelf:      { x: 1,  y: 4,  w: 2, h: 2 },
  tinter:     { x: 11, y: 2,  w: 4, h: 4 },
  shaker:     { x: 1,  y: 8,  w: 2, h: 2 },
  colorcheck: { x: 1,  y: 11, w: 2, h: 2 },
  mistint:    { x: 12, y: 11, w: 3, h: 2 },
};

const BASE_ORDERS: Order[] = [
  { name: "Ocean Teal",    r: 0,   g: 160, b: 170 },
  { name: "Sunset Orange", r: 230, g: 100, b: 20  },
  { name: "Lavender",      r: 150, g: 80,  b: 210 },
  { name: "Lime Green",    r: 60,  g: 200, b: 40  },
  { name: "Hot Pink",      r: 220, g: 30,  b: 130 },
  { name: "Chocolate",     r: 130, g: 60,  b: 20  },
  { name: "Sky Blue",      r: 80,  g: 160, b: 240 },
  { name: "Coral",         r: 240, g: 110, b: 90  },
  { name: "Forest Green",  r: 30,  g: 110, b: 50  },
  { name: "Deep Purple",   r: 100, g: 10,  b: 160 },
];

const EXTRA_ORDERS: Order[] = [
  { name: "Burnt Sienna",  r: 170, g: 80,  b: 30  },
  { name: "Mint",          r: 60,  g: 220, b: 170 },
  { name: "Marigold",      r: 240, g: 180, b: 20  },
  { name: "Dusty Rose",    r: 190, g: 110, b: 130 },
  { name: "Teal Black",    r: 20,  g: 70,  b: 80  },
  { name: "Electric Blue",  r: 30,  g: 90,  b: 255 },
  { name: "Olive Drab",    r: 100, g: 120, b: 40  },
  { name: "Plum",          r: 140, g: 30,  b: 100 },
  { name: "Rust",          r: 180, g: 50,  b: 10  },
  { name: "Seafoam",       r: 90,  g: 200, b: 160 },
];

type ShopUpgrade = {
  id: string; name: string; emoji: string; description: string;
  cost: number; maxLevel: number;
};

const SHOP_UPGRADES: ShopUpgrade[] = [
  { id: "skates", name: "Roller Skates", emoji: "⛸️", description: "Move faster", cost: 30, maxLevel: 3 },
  { id: "customers", name: "Customer Variety", emoji: "👥", description: "Unlock new colors", cost: 40, maxLevel: 2 },
  { id: "employee", name: "Employee", emoji: "🧑‍🔧", description: "Faster shaking", cost: 60, maxLevel: 2 },
  { id: "tips", name: "Tip Jar", emoji: "💰", description: "+15% pay bonus", cost: 80, maxLevel: 2 },
];

function rgbStr({ r, g, b }: RGB) { return `rgb(${r},${g},${b})`; }
function colorDistance(a: RGB, b: RGB) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
function matchScore(dist: number) { return Math.max(0, Math.round(100 - (dist / 441) * 100)); }
function basePay(score: number) {
  if (score >= 90) return 50;
  if (score >= 75) return 35;
  if (score >= 55) return 20;
  if (score >= 35) return 10;
  return 3;
}
function speedMultiplier(elapsed: number) { return Math.max(0.5, 1.0 - (elapsed / TIME_BONUS_MAX) * 0.5); }
function inZone(px: number, py: number, zone: { x: number; y: number; w: number; h: number }) {
  const zx = zone.x * TILE, zy = zone.y * TILE, zw = zone.w * TILE, zh = zone.h * TILE;
  return px + 20 > zx && px < zx + zw && py + 20 > zy && py < zy + zh;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PixelChar({ x, y, facing, walking, step }: { x: number; y: number; facing: string; walking: boolean; step: number }) {
  const frame = walking ? step % 2 : 0;
  const flip = facing === "left" ? "scaleX(-1)" : "none";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 24, height: 32, transform: flip, zIndex: 10 }}>
      <div style={{ position: "absolute", left: 4, top: 0, width: 16, height: 14, background: "#f5c89a", border: "2px solid #b8823a", borderRadius: 3 }} />
      <div style={{ position: "absolute", left: 4, top: 0, width: 16, height: 5, background: "#3d2b1f", borderRadius: "3px 3px 0 0" }} />
      <div style={{ position: "absolute", left: 7, top: 5, width: 3, height: 3, background: "#1a1a1a", borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 14, top: 5, width: 3, height: 3, background: "#1a1a1a", borderRadius: "50%" }} />
      <div style={{ position: "absolute", left: 3, top: 13, width: 18, height: 12, background: "#e8f4e8", border: "2px solid #4a7a4a" }} />
      <div style={{ position: "absolute", left: 7, top: 14, width: 10, height: 10, background: "#f0e8d0", border: "1px solid #c8a060" }} />
      <div style={{ position: "absolute", left: 5, top: 24, width: 6, height: 8, background: "#3a5a8a", transform: frame ? "translateY(2px)" : "none", border: "1px solid #2a4a6a" }} />
      <div style={{ position: "absolute", left: 13, top: 24, width: 6, height: 8, background: "#3a5a8a", transform: frame ? "translateY(-2px)" : "none", border: "1px solid #2a4a6a" }} />
      <div style={{ position: "absolute", left: 3, top: 30, width: 8, height: 4, background: "#1a1a1a", transform: frame ? "translateY(2px)" : "none" }} />
      <div style={{ position: "absolute", left: 13, top: 30, width: 8, height: 4, background: "#1a1a1a", transform: frame ? "translateY(-2px)" : "none" }} />
    </div>
  );
}

function ShakerClock({ zone, timeLeft, total }: { zone: { x: number; y: number; w: number; h: number }; timeLeft: number; total: number }) {
  const cx = zone.x * TILE + zone.w * TILE / 2, cy = zone.y * TILE - 36;
  const pct = timeLeft / total, r = 16, circ = 2 * Math.PI * r, dash = circ * pct;
  const shake = Math.sin(Date.now() / 60) * 3;
  return (
    <div style={{ position: "absolute", left: cx - 28, top: cy - 20, zIndex: 20,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pointerEvents: "none" }}>
      <div style={{ fontSize: 22, transform: `rotate(${shake}deg) translateX(${shake}px)`,
        filter: "drop-shadow(0 0 6px #ffee88)" }}>🥫</div>
      <svg width={56} height={56} style={{ overflow: "visible" }}>
        <circle cx={28} cy={28} r={r} fill="#1a1a2a" stroke="#444" strokeWidth={4} />
        <circle cx={28} cy={28} r={r} fill="none"
          stroke={pct > 0.5 ? "#50ffaa" : pct > 0.25 ? "#ffcc40" : "#ff5050"}
          strokeWidth={4} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 28 28)" style={{ transition: "stroke-dasharray 0.2s, stroke 0.3s" }} />
        <text x={28} y={33} textAnchor="middle" fontSize={13} fontWeight="bold"
          fill="#fff" fontFamily="'Courier New', monospace">{timeLeft}s</text>
      </svg>
      <div style={{ color: "#ffee88", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>SHAKING</div>
    </div>
  );
}

function ColorCheckModal({ order, mixColor, onClose }: { order: Order; mixColor: RGB; onClose: () => void }) {
  const dist = colorDistance(mixColor, order);
  const score = matchScore(dist);
  const barColor = score >= 75 ? "#50ff80" : score >= 50 ? "#ffcc40" : "#ff5050";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0a0a1a", border: "3px solid #50ccff", borderRadius: 12,
        padding: "20px 24px", minWidth: 260, textAlign: "center",
        boxShadow: "0 0 40px #50ccff40" }} onClick={e => e.stopPropagation()}>
        <div style={{ color: "#50ccff", fontWeight: "bold", fontSize: 14, letterSpacing: 2, marginBottom: 14 }}>🔍 COLOR CHECK</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#aaa", fontSize: 11, marginBottom: 6 }}>TARGET</div>
            <div style={{ width: 70, height: 70, borderRadius: 8, background: rgbStr(order),
              border: "3px solid #fff", boxShadow: "0 0 16px " + rgbStr(order) + "80" }} />
            <div style={{ color: "#aaa", fontSize: 10, marginTop: 4 }}>{order.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "#444", fontSize: 22 }}>vs</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#aaa", fontSize: 11, marginBottom: 6 }}>YOUR MIX</div>
            <div style={{ width: 70, height: 70, borderRadius: 8, background: rgbStr(mixColor),
              border: "3px solid #fff", boxShadow: "0 0 16px " + rgbStr(mixColor) + "80" }} />
            <div style={{ color: "#aaa", fontSize: 10, marginTop: 4 }}>current tint</div>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", marginBottom: 4 }}>
            <span>match</span><span style={{ color: barColor, fontWeight: "bold" }}>{score}%</span>
          </div>
          <div style={{ height: 8, background: "#222", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${score}%`, height: "100%", background: barColor,
              borderRadius: 4, transition: "width 0.4s" }} />
          </div>
        </div>
        <div style={{ color: "#aaa", fontSize: 11, marginBottom: 14 }}>
          {score >= 90 ? "Perfect! 🌟" : score >= 75 ? "Looking great! ✨" : score >= 50 ? "Getting closer 👍" : "Way off — consider retinting 😬"}
        </div>
        <button onClick={onClose} style={{ background: "#50ccff", color: "#000", border: "none",
          padding: "8px 24px", cursor: "pointer", fontWeight: "bold", fontSize: 13, borderRadius: 6 }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { onGameOver: (payload: GameOverPayload) => void };

export default function PaintShop({ onGameOver }: Props) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(1, (window.innerWidth - 16) / W));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [pos, setPos] = useState({ x: 7 * TILE, y: 7 * TILE });
  const [facing, setFacing] = useState("right");
  const [walking, setWalking] = useState(false);
  const [step, setStep] = useState(0);
  const targetRef = useRef({ x: 7 * TILE, y: 7 * TILE });
  const animRef = useRef<number>(0);
  const stepRef = useRef(0);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [order, setOrder] = useState<Order | null>(null);
  const [hasPaint, setHasPaint] = useState(false);
  const [paintTinted, setPaintTinted] = useState(false);
  const [paintShaken, setPaintShaken] = useState(false);
  const [shakeTimeLeft, setShakeTimeLeft] = useState(0);
  const [mixColor, setMixColor] = useState<RGB>({ r: 128, g: 128, b: 128 });
  const [orderStartTime, setOrderStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("Walk to the counter to take an order!");
  const [lastResult, setLastResult] = useState<OrderResult | null>(null);
  const [activeZone, setActiveZone] = useState<ZoneKey | null>(null);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showColorCheck, setShowColorCheck] = useState(false);
  const [mistintCount, setMistintCount] = useState(0);
  const [dayTimeLeft, setDayTimeLeft] = useState(DAY_DURATION);
  const [dayOver, setDayOver] = useState(false);
  const [orderHistory, setOrderHistory] = useState<HistoryItem[]>([]);
  const [perfectMatch, setPerfectMatch] = useState(false);
  const [, setClockTick] = useState(0);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [showShop, setShowShop] = useState(false);

  const skatesLevel = upgradeLevels["skates"] ?? 0;
  const customerLevel = upgradeLevels["customers"] ?? 0;
  const employeeLevel = upgradeLevels["employee"] ?? 0;
  const tipsLevel = upgradeLevels["tips"] ?? 0;

  const currentSpeed = SPEED + skatesLevel * 1.2;
  const currentShakeDuration = Math.max(1, SHAKE_DURATION - employeeLevel);
  const tipBonus = 1 + tipsLevel * 0.15;
  const orderPool = customerLevel === 0
    ? BASE_ORDERS
    : customerLevel === 1
      ? [...BASE_ORDERS, ...EXTRA_ORDERS.slice(0, 5)]
      : [...BASE_ORDERS, ...EXTRA_ORDERS];

  const speedRef = useRef(currentSpeed);
  useEffect(() => { speedRef.current = currentSpeed; }, [currentSpeed]);
  const orderPoolRef = useRef(orderPool);
  useEffect(() => { orderPoolRef.current = orderPool; }, [orderPool]);
  const shakeDurRef = useRef(currentShakeDuration);
  useEffect(() => { shakeDurRef.current = currentShakeDuration; }, [currentShakeDuration]);
  const tipBonusRef = useRef(tipBonus);
  useEffect(() => { tipBonusRef.current = tipBonus; }, [tipBonus]);

  // Refs so dayOver effect can read latest values
  const totalRef = useRef(0);
  const completedOrdersRef = useRef(0);
  const mistintCountRef = useRef(0);
  const perfectMatchRef = useRef(false);
  const gameOverFiredRef = useRef(false);
  useEffect(() => { totalRef.current = total; }, [total]);
  useEffect(() => { completedOrdersRef.current = completedOrders; }, [completedOrders]);
  useEffect(() => { mistintCountRef.current = mistintCount; }, [mistintCount]);
  useEffect(() => { perfectMatchRef.current = perfectMatch; }, [perfectMatch]);

  // Refs to avoid stale closures in autoInteract
  const phaseRef = useRef(phase);
  const hasPaintRef = useRef(hasPaint);
  const paintTintedRef = useRef(paintTinted);
  const paintShakenRef = useRef(paintShaken);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { hasPaintRef.current = hasPaint; }, [hasPaint]);
  useEffect(() => { paintTintedRef.current = paintTinted; }, [paintTinted]);
  useEffect(() => { paintShakenRef.current = paintShaken; }, [paintShaken]);

  // ── Movement ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      setPos(prev => {
        const tx = targetRef.current.x, ty = targetRef.current.y;
        const dx = tx - prev.x, dy = ty - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const spd = speedRef.current;
        if (dist < spd) { setWalking(false); return { x: tx, y: ty }; }
        setWalking(true);
        if (Math.abs(dx) > Math.abs(dy)) setFacing(dx > 0 ? "right" : "left");
        else setFacing(dy > 0 ? "down" : "up");
        return { x: prev.x + (dx / dist) * spd, y: prev.y + (dy / dist) * spd };
      });
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    if (walking) {
      stepTimerRef.current = setInterval(() => { stepRef.current += 1; setStep(stepRef.current); }, 200);
    } else if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
    }
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); };
  }, [walking]);

  // ── Timers ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (dayOver) return;
    const t = setInterval(() => {
      setDayTimeLeft(s => {
        if (s <= 1) { setDayOver(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [dayOver]);

  useEffect(() => {
    if (!orderStartTime || phase === "idle" || phase === "result") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - orderStartTime) / 1000)), 500);
    return () => clearInterval(t);
  }, [orderStartTime, phase]);

  useEffect(() => {
    if (phase !== "shaking") return;
    if (shakeTimeLeft <= 0) {
      setPaintShaken(true); setPhase("shaken");
      setMessage("Paint is ready! Bring it back to the counter for payment.");
      return;
    }
    const t = setTimeout(() => setShakeTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, shakeTimeLeft]);

  useEffect(() => {
    if (phase !== "shaking") return;
    const t = setInterval(() => setClockTick(c => c + 1), 50);
    return () => clearInterval(t);
  }, [phase]);

  // Day over → signal platform
  useEffect(() => {
    if (!dayOver || gameOverFiredRef.current) return;
    gameOverFiredRef.current = true;
    // Small delay so any in-flight cashing_out state update can settle
    const t = setTimeout(() => {
      onGameOver({
        coinsEarned: totalRef.current,
        distance: 0,
        metadata: {
          total: totalRef.current,
          completedOrders: completedOrdersRef.current,
          mistintCount: mistintCountRef.current,
          perfectMatch: perfectMatchRef.current,
        },
      });
    }, 400);
    return () => clearTimeout(t);
  }, [dayOver, onGameOver]);

  // ── Interactions ──────────────────────────────────────────────────────────────
  const moveTo = useCallback((px: number, py: number) => { targetRef.current = { x: px, y: py }; }, []);

  const autoInteract = useCallback((zone: ZoneKey) => {
    const p = phaseRef.current, hp = hasPaintRef.current,
      pt = paintTintedRef.current, ps = paintShakenRef.current;

    if (zone === "counter") {
      if (p === "idle") {
        const pool = orderPoolRef.current;
        const o = pool[Math.floor(Math.random() * pool.length)];
        setOrder(o); setHasPaint(false); setPaintTinted(false); setPaintShaken(false);
        setMixColor({ r: 128, g: 128, b: 128 });
        const now = Date.now(); setOrderStartTime(now); setElapsed(0);
        setPhase("got_order");
        setMessage(`Order: "${o.name}"! Head to the shelf.`);
      } else if (p === "shaken" && ps) {
        setPhase("cashing_out");
      }
    }
    if (zone === "shelf" && p === "got_order" && !hp) {
      setHasPaint(true); setPhase("has_paint");
      setMessage("Got the paint! Head to the tint station.");
    }
    if (zone === "tinter" && p === "has_paint" && hp && !pt) {
      setPhase("tinting");
      setMessage("Set your RGB values, then lock in the tint.");
    }
    if (zone === "shaker" && p === "tinted" && pt && !ps) {
      setPhase("shaking"); setShakeTimeLeft(shakeDurRef.current);
      setMessage("Shaking… wait for it!");
    }
    if (zone === "colorcheck") {
      if (hp && ps) setShowColorCheck(true);
      else if (hp && pt && !ps) setMessage("Shake the paint first, then check the color!");
      else if (hp && !pt) setMessage("Tint your paint first before checking.");
      else setMessage("You need to be carrying paint to use the color checker.");
    }
    if (zone === "mistint" && hp) {
      setHasPaint(false); setPaintTinted(false); setPaintShaken(false);
      setMistintCount(c => c + 1);
      setPhase("got_order");
      setMessage("Paint dumped! Grab a fresh can — your slider values are saved.");
    }
  }, []);

  useEffect(() => {
    let zone: ZoneKey | null = null;
    for (const [key, z] of Object.entries(ZONES) as [ZoneKey, typeof ZONES[ZoneKey]][]) {
      if (inZone(pos.x, pos.y, z)) { zone = key; break; }
    }
    setActiveZone(prev => {
      if (prev === zone) return prev;
      if (zone) autoInteract(zone);
      return zone;
    });
  }, [pos, autoInteract]);

  // Cash out
  useEffect(() => {
    if (phase !== "cashing_out") return;
    const elapsedNow = Math.floor((Date.now() - (orderStartTime ?? Date.now())) / 1000);
    const dist = colorDistance(mixColor, order!);
    const score = matchScore(dist);
    const base = basePay(score);
    const mult = speedMultiplier(elapsedNow);
    const pay = Math.round(base * mult * tipBonusRef.current);
    if (score === 100) setPerfectMatch(true);
    setTotal(t => t + pay); setCompletedOrders(c => c + 1);
    setLastResult({ score, pay, base, mult: mult * tipBonusRef.current, dist: Math.round(dist), elapsed: elapsedNow });
    setOrderHistory(h => [...h, { name: order!.name, score, pay, elapsed: elapsedNow }]);
    setOrder(null); setHasPaint(false); setPaintTinted(false); setPaintShaken(false);
    setMixColor({ r: 128, g: 128, b: 128 });
    setOrderStartTime(null); setElapsed(0);
    setPhase("result");
    setMessage(`Paid! ${score}% match × ${mult.toFixed(2)}x speed = $${pay}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const confirmTint = () => {
    setPaintTinted(true); setPhase("tinted");
    setMessage("Color locked! Use Color Check to verify, then shake it.");
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (phase === "tinting" || phase === "shaking" || showInstructions || showColorCheck || dayOver) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale - 12;
    const my = (e.clientY - rect.top) / scale - 16;
    moveTo(Math.max(0, Math.min(W - 24, mx)), Math.max(0, Math.min(H - 32, my)));
  };

  const dismissResult = () => { setPhase("idle"); setLastResult(null); setMessage("Walk to the counter to take an order!"); };

  const zoneHint = () => {
    if (activeZone === "counter" && phase === "idle") return "Take order";
    if (activeZone === "counter" && phase === "shaken" && paintShaken) return "Cash out!";
    if (activeZone === "shelf" && phase === "got_order" && !hasPaint) return "Grab paint";
    if (activeZone === "tinter" && phase === "has_paint") return "Tint paint";
    if (activeZone === "shaker" && phase === "tinted" && paintTinted) return "Shake it";
    if (activeZone === "colorcheck" && hasPaint && paintShaken) return "Check color";
    if (activeZone === "mistint" && hasPaint) return "Dump paint";
    return null;
  };

  const floorTiles: { x: number; y: number; key: string }[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) floorTiles.push({ x: c * TILE, y: r * TILE, key: `${c}-${r}` });

  const steps = [
    { label: "Order", done: phase !== "idle", active: phase === "idle" },
    { label: "Shelf", done: hasPaint, active: phase === "got_order" },
    { label: "Tint",  done: paintTinted, active: phase === "has_paint" || phase === "tinting" },
    { label: "Shake", done: paintShaken, active: phase === "tinted" || phase === "shaking" },
    { label: "Cash",  done: phase === "result", active: phase === "shaken" },
  ];

  const scaledW = W * scale, hudH = 52;
  const mult = orderStartTime ? speedMultiplier(elapsed) : 1.0;
  const multPct = (mult - 0.5) / 0.5;
  const multColor = multPct > 0.6 ? "#50ff80" : multPct > 0.3 ? "#ffcc40" : "#ff5050";

  return (
    <div style={{ minHeight: "100vh", background: "#1a0a00", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace", padding: "8px 4px" }}>

      {showColorCheck && order && (
        <ColorCheckModal order={order} mixColor={mixColor} onClose={() => setShowColorCheck(false)} />
      )}

      {/* Header */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 6,
        color: "#f5c840", fontSize: 12, letterSpacing: 2, textTransform: "uppercase",
        flexWrap: "wrap", justifyContent: "center" }}>
        <span>🎨 Paint Shop</span>
        <span style={{ color: "#80ff80" }}>💰 ${total}</span>
        <span style={{ color: "#80cfff" }}>📋 {completedOrders}</span>
        {mistintCount > 0 && <span style={{ color: "#ff8060" }}>🗑 {mistintCount}</span>}
        <span style={{
          color: dayTimeLeft > 30 ? "#f5c840" : dayTimeLeft > 10 ? "#ffaa40" : "#ff5050",
          fontWeight: "bold", fontSize: 13,
          animation: dayTimeLeft <= 10 ? "pulse 0.5s infinite alternate" : "none",
        }}>
          🕐 {Math.floor(dayTimeLeft / 60)}:{String(dayTimeLeft % 60).padStart(2, "0")}
        </span>
        {orderStartTime && phase !== "result" && (
          <span style={{ color: multColor, fontSize: 11 }}>⚡{mult.toFixed(2)}x ({elapsed}s)</span>
        )}
        <button onClick={() => setShowInstructions(v => !v)}
          style={{ background: "#3a1a00", border: "1px solid #f5c840", color: "#f5c840",
            padding: "2px 8px", cursor: "pointer", fontSize: 11, borderRadius: 3 }}>
          {showInstructions ? "Hide" : "Help"}
        </button>
        <button onClick={() => setShowShop(v => !v)}
          style={{ background: "#3a1a00", border: "1px solid #80cfff", color: "#80cfff",
            padding: "2px 8px", cursor: "pointer", fontSize: 11, borderRadius: 3 }}>
          {showShop ? "Close" : "🛒 Shop"}
        </button>
      </div>

      {showShop && (
        <div style={{ background: "#0a0a1aee", border: "2px solid #80cfff", borderRadius: 8,
          padding: "12px 16px", marginBottom: 8, color: "#f5e8c0",
          maxWidth: scaledW, fontSize: 12, boxSizing: "border-box" }}>
          <div style={{ color: "#80cfff", fontWeight: "bold", fontSize: 13, letterSpacing: 2, textAlign: "center", marginBottom: 10 }}>
            🛒 UPGRADES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SHOP_UPGRADES.map(u => {
              const lvl = upgradeLevels[u.id] ?? 0;
              const maxed = lvl >= u.maxLevel;
              const canBuy = !maxed && total >= u.cost;
              return (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: 6, border: "1px solid #333",
                  background: canBuy ? "#1a2a3a" : "#111" }}>
                  <span style={{ fontSize: 18 }}>{u.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                      {u.name} <span style={{ color: maxed ? "#50ff50" : "#888", fontSize: 10 }}>
                        {maxed ? "MAX" : `Lv.${lvl}/${u.maxLevel}`}
                      </span>
                    </div>
                    <div style={{ color: "#888", fontSize: 10 }}>{u.description}</div>
                  </div>
                  {!maxed && (
                    <button
                      onClick={() => {
                        if (!canBuy) return;
                        setTotal(t => t - u.cost);
                        setUpgradeLevels(l => ({ ...l, [u.id]: (l[u.id] ?? 0) + 1 }));
                      }}
                      disabled={!canBuy}
                      style={{ background: canBuy ? "#80cfff" : "#333", color: canBuy ? "#000" : "#666",
                        border: "none", padding: "4px 12px", cursor: canBuy ? "pointer" : "default",
                        fontWeight: "bold", fontSize: 11, borderRadius: 4, whiteSpace: "nowrap" }}>
                      ${u.cost}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ color: "#666", fontSize: 10, textAlign: "center", marginTop: 8 }}>
            Spend your earnings on upgrades!
          </div>
        </div>
      )}

      {showInstructions && (
        <div style={{ background: "#1a0a00ee", border: "2px solid #f5c840", borderRadius: 8,
          padding: "12px 16px", marginBottom: 8, color: "#f5e8c0",
          maxWidth: scaledW, fontSize: 12, lineHeight: 1.8, boxSizing: "border-box" }}>
          <strong style={{ color: "#f5c840", fontSize: 13 }}>🖌️ How to Play</strong><br />
          <span style={{ color: "#aaa" }}>Tap the map to move. Walk into a station to use it!</span><br />
          1️⃣ <strong style={{ color: "#ffcc80" }}>Counter</strong> — take a color order (timer starts!)<br />
          2️⃣ <strong style={{ color: "#ccaaff" }}>Shelf</strong> — grab a paint can<br />
          3️⃣ <strong style={{ color: "#80ffcc" }}>Tint Station</strong> — set RGB sliders &amp; lock in<br />
          4️⃣ <strong style={{ color: "#ffee88" }}>Shaker</strong> — shake for {currentShakeDuration}s<br />
          5️⃣ <strong style={{ color: "#50ccff" }}>Color Check</strong> — compare your tint to the target<br />
          6️⃣ <strong style={{ color: "#ffcc80" }}>Counter</strong> — return for payment!<br />
          <span style={{ color: "#ff8060" }}>🗑 Mistint Pile — dump &amp; restart if you messed up<br /></span>
          <span style={{ color: "#ff9060" }}>Faster = bigger speed bonus! ⚡</span><br />
          <button onClick={() => setShowInstructions(false)}
            style={{ marginTop: 8, background: "#f5c840", border: "none", color: "#1a0a00",
              padding: "4px 14px", cursor: "pointer", fontWeight: "bold", borderRadius: 3 }}>
            Got it!
          </button>
        </div>
      )}

      {/* Scaled game world */}
      <div style={{ width: scaledW, height: (H + hudH) * scale, position: "relative", flexShrink: 0 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left",
          width: W, height: H + hudH, position: "absolute", top: 0, left: 0 }}>

          <div onClick={handleMapClick} style={{
            width: W, height: H, position: "relative",
            cursor: (phase === "tinting" || phase === "shaking") ? "default" : "crosshair",
            border: "3px solid #5a3010", overflow: "hidden", boxShadow: "0 0 40px #f5c84040",
          }}>

            {/* Floor */}
            {floorTiles.map(t => (
              <div key={t.key} style={{ position: "absolute", left: t.x, top: t.y, width: TILE, height: TILE,
                background: ((t.x / TILE + t.y / TILE) % 2 === 0) ? "#d4b896" : "#c8a880" }} />
            ))}
            <div style={{ position: "absolute", left: 0, top: 0, width: W, height: TILE * 0.6,
              background: "#5a3010", borderBottom: "4px solid #3a1a00" }} />

            {/* COUNTER */}
            <div style={{ position: "absolute",
              left: ZONES.counter.x * TILE, top: ZONES.counter.y * TILE,
              width: ZONES.counter.w * TILE, height: ZONES.counter.h * TILE,
              background: "#8B4513",
              border: `3px solid ${phase === "shaken" && paintShaken ? "#50ff50" : "#5a2d0a"}`,
              borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 2,
              boxShadow: phase === "shaken" && paintShaken ? "0 0 16px #50ff5080" : "none",
              transition: "border-color 0.3s,box-shadow 0.3s" }}>
              <span style={{ fontSize: 22 }}>🪟</span>
              <span style={{ color: "#f5e8c0", fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>COUNTER</span>
              {order && (
                <div style={{ position: "absolute", top: -62, left: "50%", transform: "translateX(-50%)",
                  background: "#fff", border: "3px solid #333", borderRadius: 6, padding: "4px 8px",
                  display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap", zIndex: 20,
                  boxShadow: "0 2px 8px #0008" }}>
                  <span style={{ fontSize: 11, color: "#333", fontWeight: "bold" }}>{order.name}</span>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: rgbStr(order), border: "2px solid #333" }} />
                </div>
              )}
              {orderStartTime && phase !== "result" && (
                <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
                  background: "#000a", borderRadius: 6, padding: "4px 8px", zIndex: 21,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 10, color: multColor, fontWeight: "bold" }}>⚡ {mult.toFixed(2)}x bonus</div>
                  <div style={{ width: 90, height: 6, background: "#333", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${multPct * 100}%`, height: "100%", background: multColor,
                      borderRadius: 3, transition: "width 0.5s,background 0.5s" }} />
                  </div>
                </div>
              )}
              {phase === "shaken" && paintShaken && (
                <div style={{ position: "absolute", bottom: -22, fontSize: 10,
                  color: "#50ff50", fontWeight: "bold", whiteSpace: "nowrap",
                  animation: "pulse 0.6s infinite alternate" }}>
                  💰 Return to cash out!
                </div>
              )}
            </div>

            {/* SHELF */}
            <div style={{ position: "absolute",
              left: ZONES.shelf.x * TILE, top: ZONES.shelf.y * TILE,
              width: ZONES.shelf.w * TILE, height: ZONES.shelf.h * TILE,
              background: "#3a2a10", border: "3px solid #ccaaff", borderRadius: 4,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <span style={{ fontSize: 22 }}>🗄️</span>
              <span style={{ color: "#ccaaff", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>SHELF</span>
              {hasPaint && (<div style={{ position: "absolute", top: -8, right: -8, background: "#50ff50",
                borderRadius: "50%", width: 16, height: 16, display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 10 }}>✓</div>)}
            </div>

            {/* TINT STATION */}
            <div style={{ position: "absolute",
              left: ZONES.tinter.x * TILE, top: ZONES.tinter.y * TILE,
              width: ZONES.tinter.w * TILE, height: ZONES.tinter.h * TILE,
              background: "#2a2a3a",
              border: `3px solid ${paintTinted ? "#50ff50" : "#7070cc"}`,
              borderRadius: 6, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4 }}>
              <span style={{ fontSize: 26 }}>🎨</span>
              <span style={{ color: paintTinted ? "#50ff50" : "#9090dd", fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>
                {paintTinted ? "TINTED!" : "TINT STATION"}
              </span>
              {paintTinted && (
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: rgbStr(mixColor),
                  border: "2px solid #fff", boxShadow: "0 0 8px " + rgbStr(mixColor) }} />
              )}
            </div>

            {/* COLOR CHECK */}
            <div style={{ position: "absolute",
              left: ZONES.colorcheck.x * TILE, top: ZONES.colorcheck.y * TILE,
              width: ZONES.colorcheck.w * TILE, height: ZONES.colorcheck.h * TILE,
              background: "#0a1a2a", border: "3px solid #50ccff", borderRadius: 4,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              boxShadow: hasPaint && paintShaken ? "0 0 12px #50ccff60" : "none",
              transition: "box-shadow 0.3s" }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <span style={{ color: "#50ccff", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>COLOR CHECK</span>
            </div>

            {/* MISTINT PILE */}
            <div style={{ position: "absolute",
              left: ZONES.mistint.x * TILE, top: ZONES.mistint.y * TILE,
              width: ZONES.mistint.w * TILE, height: ZONES.mistint.h * TILE,
              background: "#1a0a0a", border: "3px solid #884444", borderRadius: 4,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
              boxShadow: hasPaint ? "0 0 10px #88444460" : "none",
              transition: "box-shadow 0.3s" }}>
              <span style={{ fontSize: 20 }}>🗑️</span>
              <span style={{ color: "#aa6666", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>MISTINT</span>
              {mistintCount > 0 && <span style={{ color: "#ff8060", fontSize: 9 }}>{mistintCount} dumped</span>}
            </div>

            {/* SHAKER */}
            <div style={{ position: "absolute",
              left: ZONES.shaker.x * TILE, top: ZONES.shaker.y * TILE,
              width: ZONES.shaker.w * TILE, height: ZONES.shaker.h * TILE,
              background: "#1a2a1a",
              border: `3px solid ${phase === "shaking" ? "#ffee88" : paintShaken ? "#50ff50" : "#557755"}`,
              borderRadius: 4, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2,
              transition: "border-color 0.3s",
              boxShadow: phase === "shaking" ? "0 0 16px #ffee8880" : "none" }}>
              <span style={{ fontSize: 22, display: "inline-block",
                animation: phase === "shaking" ? "shakeit 0.12s infinite alternate" : "none" }}>🥫</span>
              <span style={{ color: phase === "shaking" ? "#ffee88" : paintShaken ? "#50ff50" : "#88aa88",
                fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>
                {phase === "shaking" ? "SHAKING" : paintShaken ? "READY!" : "SHAKER"}
              </span>
            </div>
            {phase === "shaking" && (
              <ShakerClock zone={ZONES.shaker} timeLeft={shakeTimeLeft} total={currentShakeDuration} />
            )}

            {/* Day Over overlay on map */}
            {dayOver && phase !== "result" && (
              <div style={{ position: "absolute", inset: 0, background: "#000000aa",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 30, borderRadius: 4, pointerEvents: "none" }}>
                <div style={{ color: "#f5c840", fontSize: 20, fontWeight: "bold", letterSpacing: 3, textShadow: "0 0 20px #f5c840" }}>
                  🔔 DAY OVER
                </div>
              </div>
            )}

            {/* Zone highlight */}
            {activeZone && zoneHint() && (
              <div style={{ position: "absolute",
                left: ZONES[activeZone].x * TILE - 3, top: ZONES[activeZone].y * TILE - 3,
                width: ZONES[activeZone].w * TILE + 6, height: ZONES[activeZone].h * TILE + 6,
                border: "3px solid #ffff00", borderRadius: 6, pointerEvents: "none",
                animation: "pulse 0.8s infinite alternate" }} />
            )}

            <PixelChar x={pos.x} y={pos.y} facing={facing} walking={walking} step={step} />
            {walking && (
              <div style={{ position: "absolute", left: targetRef.current.x + 6, top: targetRef.current.y + 26,
                width: 12, height: 6, borderRadius: "50%", background: "#ffffff30", pointerEvents: "none" }} />
            )}
          </div>

          {/* HUD */}
          <div style={{ background: "#1a0a00", border: "2px solid #5a3010", borderTop: "none",
            padding: "8px 12px", height: hudH, boxSizing: "border-box",
            display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%",
                    background: s.done ? "#50ff50" : s.active ? "#f5c840" : "#333",
                    border: `2px solid ${s.done ? "#50ff50" : s.active ? "#f5c840" : "#555"}`,
                    boxShadow: s.active ? "0 0 6px #f5c840" : "none", transition: "all 0.3s" }} />
                  <span style={{ color: "#666", fontSize: 8 }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, color: "#f5e8c0", fontSize: 11, minWidth: 80 }}>💬 {message}</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ color: "#888", fontSize: 11 }}>BAG:</span>
              <div style={{ width: 22, height: 22, borderRadius: 4,
                background: hasPaint ? (paintShaken ? "#80ffaa" : paintTinted ? rgbStr(mixColor) : "#ccaaff") : "#333",
                border: `2px solid ${hasPaint ? "#fff" : "#555"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, transition: "all 0.3s" }}>
                {hasPaint ? "🥫" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tinting Panel */}
      {phase === "tinting" && order && (
        <div style={{ marginTop: 12, background: "#0a0a1a", border: "3px solid #7070cc",
          borderRadius: 10, padding: "16px", width: Math.min(scaledW, 520),
          boxShadow: "0 0 30px #7070cc40", boxSizing: "border-box" }}>
          <div style={{ color: "#9090dd", fontWeight: "bold", fontSize: 14,
            letterSpacing: 2, textAlign: "center", marginBottom: 12 }}>🎨 TINT STATION</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#aaa", fontSize: 11, marginBottom: 6 }}>TARGET COLOR</div>
              <div style={{ width: 80, height: 80, borderRadius: 8, background: rgbStr(order),
                border: "3px solid #fff", boxShadow: "0 0 24px " + rgbStr(order) + "90" }} />
              <div style={{ color: "#f5e8c0", fontSize: 12, marginTop: 6, fontWeight: "bold" }}>{order.name}</div>
            </div>
          </div>
          {([{ ch: "r" as const, label: "Red", color: "#ff5050" }, { ch: "g" as const, label: "Green", color: "#50ff50" }, { ch: "b" as const, label: "Blue", color: "#5090ff" }]).map(({ ch, label, color }) => (
            <div key={ch} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color, fontSize: 12, width: 40 }}>{label}</span>
              <input type="range" min={0} max={255} value={mixColor[ch]}
                onChange={e => setMixColor(m => ({ ...m, [ch]: Number(e.target.value) }))}
                style={{ flex: 1, accentColor: color, height: 6, cursor: "pointer" }} />
              <span style={{ color: "#aaa", fontSize: 11, width: 28, textAlign: "right" }}>{mixColor[ch]}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 4 }}>
            <button onClick={confirmTint} style={{ background: "#7070cc", color: "#fff",
              border: "none", padding: "10px 28px", cursor: "pointer", fontWeight: "bold",
              fontSize: 14, borderRadius: 6, letterSpacing: 1, boxShadow: "0 0 14px #7070cc60" }}>
              ✅ LOCK IN TINT
            </button>
          </div>
          <div style={{ color: "#666", fontSize: 10, textAlign: "center", marginTop: 8 }}>
            Use the Color Check station after locking in to see how close you are.
          </div>
        </div>
      )}

      {/* Result */}
      {phase === "result" && lastResult && (
        <div style={{ marginTop: 12, background: "#0a1a0a",
          border: `3px solid ${lastResult.score >= 75 ? "#50ff50" : "#ff8040"}`,
          borderRadius: 10, padding: "20px 24px", textAlign: "center",
          boxShadow: `0 0 30px ${lastResult.score >= 75 ? "#50ff5040" : "#ff804040"}`,
          minWidth: 240, maxWidth: Math.min(scaledW, 340), boxSizing: "border-box" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>
            {lastResult.score >= 90 ? "🌟" : lastResult.score >= 75 ? "✨" : lastResult.score >= 50 ? "👍" : "😅"}
          </div>
          {lastResult.score === 100 && (
            <div style={{ color: "#ffd700", fontSize: 12, fontWeight: "bold", marginBottom: 6, letterSpacing: 1 }}>
              🎯 EXACT MATCH!
            </div>
          )}
          <div style={{ color: "#f5e8c0", fontSize: 15, fontWeight: "bold", marginBottom: 8 }}>
            {lastResult.score >= 90 ? "Perfect Match!" : lastResult.score >= 75 ? "Great Work!" :
              lastResult.score >= 50 ? "Good Try!" : "Keep Practicing!"}
          </div>
          <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
            Color match: <strong style={{ color: "#fff" }}>{lastResult.score}%</strong>
          </div>
          <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
            Time: <strong style={{ color: "#fff" }}>{lastResult.elapsed}s</strong>
          </div>
          <div style={{ color: "#aaa", fontSize: 12, marginBottom: 12 }}>
            Speed bonus: <strong style={{ color: lastResult.mult >= 0.9 ? "#50ff80" : "#ffcc40" }}>{lastResult.mult.toFixed(2)}x</strong>
          </div>
          <div style={{ color: "#aaa", fontSize: 12, marginBottom: 4 }}>
            ${lastResult.base} base × {lastResult.mult.toFixed(2)}x speed
          </div>
          <div style={{ color: "#80ff80", fontSize: 22, fontWeight: "bold", marginBottom: 16 }}>
            = ${lastResult.pay} earned!
          </div>
          <button onClick={dismissResult} style={{ background: "#f5c840", color: "#1a0a00",
            border: "none", padding: "8px 24px", cursor: "pointer", fontWeight: "bold",
            fontSize: 13, borderRadius: 6 }}>
            Next Order →
          </button>
        </div>
      )}

      {/* End of Day Summary (shown while waiting for onGameOver to fire) */}
      {dayOver && !gameOverFiredRef.current && (
        <div style={{ marginTop: 12, background: "#0a0a00",
          border: "3px solid #f5c840", borderRadius: 10,
          padding: "20px 24px", textAlign: "center",
          boxShadow: "0 0 40px #f5c84050",
          width: Math.min(scaledW, 380), boxSizing: "border-box" }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🌅</div>
          <div style={{ color: "#f5c840", fontWeight: "bold", fontSize: 16,
            letterSpacing: 2, marginBottom: 16 }}>END OF DAY — Submitting…</div>
          {orderHistory.length > 0 ? (
            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: 1,
                textTransform: "uppercase", marginBottom: 8 }}>Orders Completed</div>
              {orderHistory.map((o, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "4px 0",
                  borderBottom: "1px solid #222", fontSize: 12 }}>
                  <span style={{ color: "#f5e8c0" }}>{o.name}</span>
                  <span style={{ color: "#aaa" }}>{o.score}% · {o.elapsed}s</span>
                  <span style={{ color: "#80ff80", fontWeight: "bold" }}>${o.pay}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>No orders completed today!</div>
          )}
          <div style={{ display: "flex", justifyContent: "space-around",
            marginBottom: 16, padding: "12px 0", borderTop: "1px solid #333", borderBottom: "1px solid #333" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#80cfff", fontSize: 20, fontWeight: "bold" }}>{completedOrders}</div>
              <div style={{ color: "#666", fontSize: 10 }}>ORDERS</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#ff8060", fontSize: 20, fontWeight: "bold" }}>{mistintCount}</div>
              <div style={{ color: "#666", fontSize: 10 }}>MISTINTS</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#80ff80", fontSize: 20, fontWeight: "bold" }}>${total}</div>
              <div style={{ color: "#666", fontSize: 10 }}>TOTAL</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { from { opacity:0.4; } to { opacity:1; } }
        @keyframes shakeit { from { transform: rotate(-12deg) translateX(-3px); } to { transform: rotate(12deg) translateX(3px); } }
        input[type=range] { -webkit-appearance:none; appearance:none; border-radius:4px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; cursor:pointer; }
      `}</style>
    </div>
  );
}
