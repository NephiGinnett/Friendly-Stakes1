"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { GameOverPayload } from "./types";

const TIERS = [
  null,
  { name: "Ore", emoji: "\u{1FAA8}" },
  { name: "Ingot", emoji: "\u{1F536}" },
  { name: "Dagger", emoji: "\u{1F5E1}️" },
  { name: "Sword", emoji: "⚔️" },
  { name: "Shield", emoji: "\u{1F6E1}️" },
  { name: "Axe", emoji: "\u{1FA93}" },
  { name: "Staff", emoji: "\u{1F52E}" },
  { name: "Relic", emoji: "\u{1F3FA}" },
  { name: "Crown", emoji: "\u{1F451}" },
  { name: "Legendary", emoji: "\u{1F31F}" },
];

const MERGE_COLORS = ["#ff6b1a","#ffcc00","#88ff44","#44ffcc","#44aaff","#8844ff","#ff44cc","#ff88ff","#ffffff"];
const ROWS = 6, COLS = 4, TOTAL = ROWS * COLS;
const AUTO_FORGE_INTERVAL = 3.5;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; decay: number; size: number; color: string };

export default function TapForge({ onGameOver }: { onGameOver: (p: GameOverPayload) => void }) {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const gridRef = useRef<(number | null)[]>(Array(TOTAL).fill(null));
  const coinsRef = useRef(0);
  const totalCoinsRef = useRef(0);
  const prestigeMultiRef = useRef(1);
  const prestigeCountRef = useRef(0);
  const autoForgeLevelRef = useRef(0);
  const luckyForgeRef = useRef(false);
  const autoForgeTimerRef = useRef(0);

  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender(n => n + 1), []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const gameOverRef = useRef(false);
  const slotsRef = useRef<(HTMLDivElement | null)[]>([]);

  const dragStateRef = useRef<{
    fromIndex: number;
    clone: HTMLDivElement;
    ox: number; oy: number;
    moved: boolean;
    startX: number; startY: number;
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const anvilTouchFiredRef = useRef(false);

  function getAudio() {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audioCtxRef.current;
  }
  function playTone(freq: number, type: OscillatorType, duration: number, vol = 0.2) {
    try {
      const ctx = getAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }
  function sfxForge() { playTone(220, "square", 0.12, 0.15); }
  function sfxSell() { playTone(440, "sine", 0.2, 0.12); playTone(550, "sine", 0.2, 0.08); }
  function sfxMerge(tier: number) {
    const freq = 180 + tier * 40;
    playTone(freq, "sawtooth", 0.08, 0.2);
    setTimeout(() => playTone(freq * 1.5, "sine", 0.25, 0.18), 80);
  }
  function sfxPrestige() {
    [300, 400, 500, 700, 900].forEach((f, i) => setTimeout(() => playTone(f, "sine", 0.3, 0.12), i * 80));
  }

  function spawnSparks(x: number, y: number, color = "#ff6b1a", n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 5;
      particlesRef.current.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, decay: 0.022 + Math.random() * 0.04, size: 2 + Math.random() * 3.5, color });
    }
  }
  function spawnRing(x: number, y: number, color: string, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, s = 3 + Math.random() * 3;
      particlesRef.current.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: 0.028 + Math.random() * 0.02, size: 3 + Math.random() * 2, color });
    }
  }

  function sellVal(t: number) { return Math.pow(1.5, t) * prestigeMultiRef.current; }
  function idleIncome() {
    let r = 0;
    const g = gridRef.current;
    for (let i = 0; i < TOTAL; i++) if (g[i]) r += sellVal(g[i]!) * 0.05;
    return r;
  }
  function firstEmpty() {
    const g = gridRef.current;
    for (let i = 0; i < TOTAL; i++) if (g[i] === null) return i;
    return -1;
  }

  const floatsRef = useRef<{ id: number; text: string; x: number; y: number; color: string; isMerge: boolean }[]>([]);
  const floatIdRef = useRef(0);
  function floatText(text: string, x: number, y: number, color = "#ffd700", isMerge = false) {
    const id = floatIdRef.current++;
    floatsRef.current.push({ id, text, x, y, color, isMerge });
    rerender();
    setTimeout(() => {
      floatsRef.current = floatsRef.current.filter(f => f.id !== id);
      rerender();
    }, 1500);
  }

  const shakeRef = useRef(false);
  function screenShake() {
    shakeRef.current = true;
    rerender();
    setTimeout(() => { shakeRef.current = false; rerender(); }, 350);
  }

  const mergePopRef = useRef<number | null>(null);

  function forgeItem(x: number, y: number) {
    const idx = firstEmpty();
    if (idx === -1) return;
    const tier = (luckyForgeRef.current && Math.random() < 0.15) ? 2 : 1;
    gridRef.current[idx] = tier;
    spawnSparks(x, y, "#ff6b1a", 14);
    sfxForge();
    if (tier === 2) floatText("⚡ Lucky!", x, y - 30, "#ffd700");
    rerender();
  }

  function sellItem(idx: number, x: number, y: number) {
    const t = gridRef.current[idx];
    if (t === null) return;
    const v = sellVal(t);
    coinsRef.current += v;
    totalCoinsRef.current += v;
    floatText("+" + Math.floor(v) + " \u{1FA99}", x, y);
    spawnSparks(x, y, "#ffd700", 8);
    sfxSell();
    gridRef.current[idx] = null;
    rerender();
  }

  function mergeItems(from: number, to: number): boolean {
    const g = gridRef.current;
    if (g[from] === null || g[to] === null || from === to || g[from] !== g[to]) return false;
    const t = g[from]!;
    if (t >= 10) {
      const v = sellVal(t) * 2;
      coinsRef.current += v;
      totalCoinsRef.current += v;
      const el = slotsRef.current[to];
      if (el) {
        const r = el.getBoundingClientRect();
        floatText("+" + Math.floor(v) + " \u{1FA99}", r.left + r.width / 2, r.top);
      }
      g[from] = null; g[to] = null;
    } else {
      g[from] = null; g[to] = t + 1;
      mergePopRef.current = to;
      setTimeout(() => { mergePopRef.current = null; rerender(); }, 200);
    }
    screenShake();
    const el = slotsRef.current[to];
    if (el) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const color = MERGE_COLORS[Math.min(t - 1, MERGE_COLORS.length - 1)];
      spawnSparks(cx, cy, color, 16 + t * 3);
      if (t >= 5) spawnRing(cx, cy, color, 18);
      const newTier = Math.min(t + 1, 10);
      floatText(`${TIERS[newTier]!.emoji} ${TIERS[newTier]!.name}!`, cx, cy - 30, color, true);
    }
    sfxMerge(t);
    rerender();
    return true;
  }

  function getSlotAt(x: number, y: number): number {
    const el = document.elementFromPoint(x, y);
    if (!el) return -1;
    const s = (el as HTMLElement).closest("[data-slot-index]") as HTMLElement | null;
    if (!s) return -1;
    return parseInt(s.dataset.slotIndex!);
  }

  function startDrag(idx: number, cx: number, cy: number) {
    if (gridRef.current[idx] === null) return;
    const t = gridRef.current[idx]!;
    const el = slotsRef.current[idx];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const clone = document.createElement("div");
    clone.style.cssText = `position:fixed;z-index:500;pointer-events:none;width:${r.width}px;height:${r.height}px;background:#2a1500;border:2px solid #ff6b1a;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:0.92;box-shadow:0 0 24px #ff6b1a99;transform:scale(1.12);`;
    clone.textContent = TIERS[t]!.emoji;
    document.body.appendChild(clone);
    const ox = cx - r.left, oy = cy - r.top;
    clone.style.left = (cx - ox) + "px";
    clone.style.top = (cy - oy) + "px";
    dragStateRef.current = { fromIndex: idx, clone, ox, oy, moved: false, startX: cx, startY: cy };
    el.style.opacity = "0.3";
  }

  function moveDrag(cx: number, cy: number) {
    const ds = dragStateRef.current;
    if (!ds) return;
    const dx = cx - ds.startX, dy = cy - ds.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) ds.moved = true;
    ds.clone.style.left = (cx - ds.ox) + "px";
    ds.clone.style.top = (cy - ds.oy) + "px";
    slotsRef.current.forEach(s => s?.classList.remove("drag-over"));
    const to = getSlotAt(cx, cy);
    if (to !== -1 && to !== ds.fromIndex && gridRef.current[to] === gridRef.current[ds.fromIndex]) {
      slotsRef.current[to]?.classList.add("drag-over");
    }
  }

  function endDrag(cx: number, cy: number) {
    const ds = dragStateRef.current;
    if (!ds) return;
    const { fromIndex, clone, moved } = ds;
    clone.remove();
    slotsRef.current.forEach(s => s?.classList.remove("drag-over"));
    const fromEl = slotsRef.current[fromIndex];
    if (fromEl) fromEl.style.opacity = "";
    const to = getSlotAt(cx, cy);
    if (!moved) {
      const el = slotsRef.current[fromIndex];
      if (el) {
        const r = el.getBoundingClientRect();
        sellItem(fromIndex, r.left + r.width / 2, r.top);
      }
    } else if (to !== -1 && to !== fromIndex) {
      if (!mergeItems(fromIndex, to) && gridRef.current[to] === null) {
        gridRef.current[to] = gridRef.current[fromIndex];
        gridRef.current[fromIndex] = null;
        rerender();
      }
    }
    dragStateRef.current = null;
  }

  // Game loop
  useEffect(() => {
    if (!started || gameOver) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resizeCanvas() {
      if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    lastTimeRef.current = performance.now();
    function loop(now: number) {
      if (gameOverRef.current) return;
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // Idle income
      coinsRef.current += idleIncome() * dt;

      // Auto-Forge
      const afl = autoForgeLevelRef.current;
      if (afl > 0) {
        autoForgeTimerRef.current += dt;
        const interval = afl === 1 ? AUTO_FORGE_INTERVAL : AUTO_FORGE_INTERVAL * 0.45;
        if (autoForgeTimerRef.current >= interval) {
          autoForgeTimerRef.current = 0;
          const idx = firstEmpty();
          if (idx !== -1) {
            const el = slotsRef.current[idx];
            if (el) {
              const rect = el.getBoundingClientRect();
              forgeItem(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
          }
        }
      }

      // Particles
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
        for (const p of particlesRef.current) {
          p.x += p.vx * dt * 60;
          p.y += p.vy * dt * 60;
          p.vy += 0.1 * dt * 60;
          p.life -= p.decay * dt * 60;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      rerender();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // Mouse/touch events for drag
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onMouseUp = (e: MouseEvent) => endDrag(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (dragStateRef.current) { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); } };
    const onTouchEnd = (e: TouchEvent) => { if (dragStateRef.current) { const t = e.changedTouches[0]; endDrag(t.clientX, t.clientY); } };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, gameOver]);

  function handleStart() {
    gridRef.current[0] = 1;
    gridRef.current[1] = 1;
    gridRef.current[2] = 1;
    setStarted(true);
  }

  function handleCashOut() {
    gameOverRef.current = true;
    setGameOver(true);
    onGameOver({
      coinsEarned: Math.floor(totalCoinsRef.current),
      distance: 0,
      metadata: {
        prestige: prestigeCountRef.current,
        totalCoins: Math.floor(totalCoinsRef.current),
        score: Math.floor(totalCoinsRef.current),
      },
    });
  }

  function buyAutoForge() {
    const lvl = autoForgeLevelRef.current;
    if (lvl === 0 && coinsRef.current >= 500) {
      coinsRef.current -= 500;
      autoForgeLevelRef.current = 1;
      floatText("⚙️ Auto-Forge ON!", window.innerWidth / 2, window.innerHeight / 2, "#ff6b1a", true);
      rerender();
    } else if (lvl === 1 && coinsRef.current >= 2000) {
      coinsRef.current -= 2000;
      autoForgeLevelRef.current = 2;
      floatText("⚙️ Auto-Forge MAX!", window.innerWidth / 2, window.innerHeight / 2, "#ffd700", true);
      rerender();
    }
  }

  function buyLuckyForge() {
    if (!luckyForgeRef.current && coinsRef.current >= 200) {
      coinsRef.current -= 200;
      luckyForgeRef.current = true;
      floatText("\u{1F340} Lucky ON!", window.innerWidth / 2, window.innerHeight / 2, "#88ff44", true);
      rerender();
    }
  }

  function doPrestige() {
    if (!confirm("Prestige? Resets grid, gives permanent x1.5 multiplier!")) return;
    sfxPrestige();
    prestigeCountRef.current++;
    prestigeMultiRef.current = Math.pow(1.5, prestigeCountRef.current);
    gridRef.current = Array(TOTAL).fill(null);
    spawnRing(window.innerWidth / 2, window.innerHeight / 2, "#bf6fff", 40);
    spawnSparks(window.innerWidth / 2, window.innerHeight / 2, "#bf6fff", 30);
    rerender();
  }

  const grid = gridRef.current;
  const coins = coinsRef.current;
  const totalCoins = totalCoinsRef.current;
  const autoLevel = autoForgeLevelRef.current;
  const hasLucky = luckyForgeRef.current;
  const hasHighTier = grid.some(t => t !== null && t >= 8);

  // Start screen
  if (!started) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 16, padding: 40, textAlign: "center",
      }}>
        <div style={{ fontSize: "3rem" }}>⚒️</div>
        <h1 style={{ fontSize: "2.5rem", color: "#ff6b1a", textShadow: "0 0 20px #ff6b1a88", fontWeight: "bold" }}>TAP FORGE</h1>
        <p style={{ color: "#888", fontSize: "0.9rem", maxWidth: 280, lineHeight: 1.5 }}>
          Tap the anvil to forge items.<br />Drag matching items to merge.<br />Tap an item to sell it!
        </p>
        <button
          onClick={handleStart}
          style={{
            padding: "14px 40px", background: "#ff6b1a", border: "none", borderRadius: 30,
            color: "#000", fontSize: "1.1rem", fontWeight: "bold", cursor: "pointer", marginTop: 8,
            boxShadow: "0 0 20px #ff6b1a88",
          }}
        >
          FORGE IT
        </button>
      </div>
    );
  }

  const onSlotMouseDown = (idx: number, e: React.MouseEvent) => {
    startDrag(idx, e.clientX, e.clientY);
    e.preventDefault();
  };
  const onSlotTouchStart = (idx: number, e: React.TouchEvent) => {
    const t = e.touches[0];
    startDrag(idx, t.clientX, t.clientY);
    e.preventDefault();
  };

  const onAnvilTouch = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    forgeItem(t.clientX, t.clientY);
    rerender();
    anvilTouchFiredRef.current = true;
    setTimeout(() => { anvilTouchFiredRef.current = false; }, 300);
    e.preventDefault();
  };
  const onAnvilClick = (e: React.MouseEvent) => {
    if (anvilTouchFiredRef.current) return;
    forgeItem(e.clientX, e.clientY);
    rerender();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 100 }}
      />

      {/* Floating text */}
      {floatsRef.current.map(f => (
        <div key={f.id} style={{
          position: "fixed", left: f.x - 20, top: f.y - 10, color: f.color,
          fontSize: f.isMerge ? "1.1rem" : "0.85rem", fontWeight: "bold",
          pointerEvents: "none", zIndex: 200,
          animation: f.isMerge ? "tf-float-merge 1.5s ease-out forwards" : "tf-float-up 1.2s ease-out forwards",
        }}>
          {f.text}
        </div>
      ))}

      <div style={{
        width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center",
        animation: shakeRef.current ? "tf-shake 0.3s ease" : "none",
      }}>
        {/* Top bar */}
        <div style={{
          width: "100%", background: "#1a1a1a", borderBottom: "1px solid #ff6b1a33",
          padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: "1.1rem", color: "#ffd700", fontWeight: "bold" }}>
              🪙 {Math.floor(coins).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#ff6b1a" }}>
              +{idleIncome().toFixed(2)}/sec idle
            </div>
          </div>
          {prestigeCountRef.current > 0 && (
            <div style={{ fontSize: "0.75rem", color: "#bf6fff" }}>
              ✨ x{prestigeMultiRef.current.toFixed(2)}
            </div>
          )}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 8, width: "100%", maxWidth: 380 }}>
            {grid.map((tier, i) => {
              const isEmpty = tier === null;
              const tierClass = tier ? `tier-${tier}` : "";
              return (
                <div
                  key={i}
                  ref={el => { slotsRef.current[i] = el; }}
                  data-slot-index={i}
                  onMouseDown={!isEmpty ? (e) => onSlotMouseDown(i, e) : undefined}
                  onTouchStart={!isEmpty ? (e) => onSlotTouchStart(i, e) : undefined}
                  className={tierClass}
                  style={{
                    aspectRatio: "1", background: "#1a1a1a",
                    border: isEmpty ? "1px dashed #2a2a2a" : "1px solid #ff6b1a44",
                    borderRadius: 10, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", position: "relative",
                    cursor: isEmpty ? "default" : "pointer", overflow: "hidden",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {tier !== null && (
                    <>
                      <div style={{
                        position: "absolute", inset: 0, borderRadius: 10, pointerEvents: "none",
                        background: tier <= 10 ? `radial-gradient(circle at center, ${MERGE_COLORS[Math.min(tier - 1, MERGE_COLORS.length - 1)]}33, transparent 70%)` : "none",
                      }} />
                      <div style={{
                        fontSize: "2rem", lineHeight: 1,
                        transform: mergePopRef.current === i ? "scale(1.4)" : "none",
                        transition: "transform 0.15s",
                      }}>
                        {TIERS[tier]!.emoji}
                      </div>
                      <div style={{ fontSize: "0.55rem", color: "#888", marginTop: 2, textTransform: "uppercase" }}>
                        {TIERS[tier]!.name}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom area */}
        <div style={{ width: "100%", padding: "12px 16px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: "0.7rem", color: "#555", textAlign: "center" }}>
            Drag items to merge &bull; Tap item to sell
          </div>

          {/* Anvil button */}
          <button
            onClick={onAnvilClick}
            onTouchEnd={onAnvilTouch}
            style={{
              width: 90, height: 90, borderRadius: "50%", border: "3px solid #ff6b1a",
              background: "radial-gradient(circle at 40% 35%, #3a1a00, #1a0a00)",
              fontSize: "2.8rem", cursor: "pointer",
              boxShadow: "0 0 20px #ff6b1a66, 0 0 40px #ff6b1a22",
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            }}
          >
            ⚒️
          </button>

          {/* Upgrades */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={buyAutoForge}
              disabled={autoLevel >= 2 || (autoLevel === 0 ? coins < 500 : coins < 2000)}
              style={{
                padding: "7px 14px", background: autoLevel > 0 ? "#2a1500" : "#1a1a1a",
                border: `1px solid ${autoLevel > 0 ? "#ff6b1a" : "#ff6b1a88"}`,
                borderRadius: 16, color: autoLevel > 0 ? "#ffd700" : "#ff6b1a",
                fontSize: "0.78rem", cursor: autoLevel >= 2 ? "default" : "pointer",
                opacity: (autoLevel >= 2 || (autoLevel === 0 ? coins < 500 : coins < 2000)) ? 0.5 : 1,
              }}
            >
              {autoLevel === 0 ? "⚙️ Auto-Forge (500🪙)" : autoLevel === 1 ? "⚙️ Upgrade Auto (2000🪙)" : "⚙️ Auto MAX ✓"}
            </button>
            <button
              onClick={buyLuckyForge}
              disabled={hasLucky || coins < 200}
              style={{
                padding: "7px 14px", background: "#1a1a1a",
                border: "1px solid #bf6fff88", borderRadius: 16,
                color: "#bf6fff", fontSize: "0.78rem",
                cursor: hasLucky ? "default" : "pointer",
                opacity: (hasLucky || coins < 200) ? 0.5 : 1,
              }}
            >
              {hasLucky ? "🍀 Lucky ON ✓" : "🍀 Lucky Forge (200🪙)"}
            </button>
          </div>

          {/* Prestige */}
          {hasHighTier && (
            <button
              onClick={doPrestige}
              style={{
                padding: "8px 20px",
                background: "linear-gradient(135deg, #3d1a6e, #6a2da0)",
                border: "1px solid #bf6fff", borderRadius: 20,
                color: "#bf6fff", fontSize: "0.85rem", cursor: "pointer",
              }}
            >
              ✨ PRESTIGE (x1.5 forever)
            </button>
          )}

          {/* Cash out */}
          <button
            onClick={handleCashOut}
            style={{
              width: "100%", padding: "10px 20px", borderRadius: 12,
              background: "#059669", border: "none", color: "#fff",
              fontSize: "0.9rem", fontWeight: "bold", cursor: "pointer",
            }}
          >
            Cash Out — 🪙 {Math.floor(totalCoins).toLocaleString()}
          </button>
          <div style={{ fontSize: "0.7rem", color: "#555", textAlign: "center" }}>
            Total forged: 🪙 {Math.floor(totalCoins).toLocaleString()} · 10 coins = 1 pt
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tf-float-up { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-50px); } }
        @keyframes tf-float-merge { 0% { opacity:1; transform:translateY(0) scale(1); } 40% { opacity:1; transform:translateY(-20px) scale(1.2); } 100% { opacity:0; transform:translateY(-60px) scale(0.8); } }
        @keyframes tf-shake { 0%,100% { transform:translate(0,0); } 20% { transform:translate(-5px,3px); } 40% { transform:translate(5px,-3px); } 60% { transform:translate(-4px,4px); } 80% { transform:translate(4px,-2px); } }
        .drag-over { border-color: #ff6b1a !important; background: #1f1008 !important; }
      `}</style>
    </>
  );
}
