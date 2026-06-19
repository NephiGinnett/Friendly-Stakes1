"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameOverPayload } from "./types";
import { ECHO_MAPS } from "@/lib/echolocateMaps";

// Pick a random map each session
const mapIndex = Math.floor(Math.random() * ECHO_MAPS.length);
const RAW_MAP = ECHO_MAPS[mapIndex].tiles;
const NR = RAW_MAP.length;
const NC = RAW_MAP[0].length;

const BASE_SPD = 2.8;
const MAX_SPD = 8;
const FADE_MS = 3500;
const PULSE_INTERVAL = 2800;
const PULSE_SPEED = 6;
const PULSE_MAX_TILES = 4;

const CS = 36; // cell size pixels (fixed; canvas scales via CSS)

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = "start" | "playing" | "dead" | "won" | "exit";

type GameState = {
  map: number[][];
  tileLastLit: number[][];
  totalBugs: number;
  score: number;
  eaten: number;
  spd: number;
  tileC: number;
  tileR: number;
  pixX: number;
  pixY: number;
  faceDX: number;
  faceDY: number;
  qDX: number;
  qDY: number;
  wingT: number;
  bugT: number;
  gameStartTs: number;
  elapsedMs: number;
  lastPulseTs: number;
  pulseRadius: number;
  pulsing: boolean;
  pulseX: number;
  pulseY: number;
  pulseAge: number;
};

type Props = { onGameOver: (payload: GameOverPayload) => void };

// ── Component ──────────────────────────────────────────────────────────────────
export default function Echolocate({ onGameOver }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const gsRef = useRef<GameState | null>(null);
  const phaseRef = useRef<Phase>("start");
  const lastTsRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("start");
  const [hudScore, setHudScore] = useState(0);
  const [hudTime, setHudTime] = useState("0.0s");
  const [hudSpeed, setHudSpeed] = useState("1.0x");
  const [echoPct, setEchoPct] = useState(100);
  const [finalData, setFinalData] = useState<{ bugPoints: number; timeBonus: number; speedBonus: number; total: number; secs: number } | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const cellBrightness = (gs: GameState, r: number, c: number, now: number): number => {
    const lit = gs.tileLastLit[r][c];
    if (lit === 0) return 0;
    const age = now - lit;
    if (age <= 0) return 1;
    if (age >= FADE_MS) return 0;
    return Math.pow(1 - age / FADE_MS, 1.4);
  };

  const tileCenter = (c: number, r: number) => ({ x: c * CS + CS / 2, y: r * CS + CS / 2 });

  const isWall = (gs: GameState, c: number, r: number) =>
    r < 0 || r >= NR || c < 0 || c >= NC || gs.map[r][c] === 1;

  const firePulse = (gs: GameState, now: number) => {
    gs.lastPulseTs = now;
    gs.pulsing = true;
    gs.pulseRadius = 0;
    gs.pulseAge = 0;
    gs.pulseX = gs.pixX;
    gs.pulseY = gs.pixY;
  };

  const calcFinalScore = (gs: GameState) => {
    const secs = gs.elapsedMs / 1000;
    const bugPoints = gs.score * 100;
    const timeBonus = Math.max(0, Math.round(5000 * (1 - secs / 120)));
    const speedBonus = Math.round((gs.spd / BASE_SPD - 1) * 500);
    return { bugPoints, timeBonus, speedBonus, total: bugPoints + timeBonus + speedBonus, secs };
  };

  // ── Init ────────────────────────────────────────────────────────────────────
  const initGame = useCallback((): GameState => {
    const map = RAW_MAP.map(r => [...r]);
    const tileLastLit = RAW_MAP.map(r => r.map(() => 0));
    let totalBugs = 0;
    let sc = 7, sr = 5;
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        if (map[r][c] === 2) totalBugs++;
        if (map[r][c] === 3) { sr = r; sc = c; map[r][c] = 0; }
      }
    }
    const center = tileCenter(sc, sr);
    return {
      map, tileLastLit, totalBugs, score: 0, eaten: 0, spd: BASE_SPD,
      tileC: sc, tileR: sr, pixX: center.x, pixY: center.y,
      faceDX: 0, faceDY: 0, qDX: 0, qDY: 0,
      wingT: 0, bugT: 0, gameStartTs: 0, elapsedMs: 0,
      lastPulseTs: 0, pulseRadius: 0, pulsing: false,
      pulseX: center.x, pulseY: center.y, pulseAge: 0,
    };
  }, []);

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback((ctx: CanvasRenderingContext2D, gs: GameState, now: number) => {
    gs.wingT += 16 * 0.013 * (gs.spd / BASE_SPD);
    gs.bugT += 0.016 * 0.003 * 1000; // driven by RAF ~60fps

    ctx.clearRect(0, 0, NC * CS, NR * CS);
    ctx.fillStyle = "#04020a";
    ctx.fillRect(0, 0, NC * CS, NR * CS);

    // Tiles with sonar fade
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        const b = cellBrightness(gs, r, c, now);
        if (b <= 0) continue;
        const x = c * CS, y = r * CS;

        if (gs.map[r][c] === 1) {
          const wallAlpha = 0.15 + b * 0.7;
          ctx.fillStyle = `rgba(26,10,46,${wallAlpha})`;
          ctx.fillRect(x, y, CS, CS);
          ctx.strokeStyle = `rgba(100,40,160,${b * 0.9})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 0.75, y + 0.75, CS - 1.5, CS - 1.5);
          if (b > 0.6) {
            ctx.strokeStyle = `rgba(168,85,247,${(b - 0.6) * 2 * 0.6})`;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x + 0.75, y + 0.75, CS - 1.5, CS - 1.5);
          }
        } else if (gs.map[r][c] === 2) {
          const bugB = Math.max(b, 0.25);
          const pulse = 0.65 + 0.35 * Math.sin(gs.bugT + c * 0.9 + r * 1.3);
          ctx.save();
          ctx.shadowColor = "#7fff3a";
          ctx.shadowBlur = 10 * pulse * bugB;
          ctx.fillStyle = `rgba(127,255,58,${pulse * bugB})`;
          ctx.beginPath();
          ctx.arc(x + CS / 2, y + CS / 2, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(127,255,58,${pulse * bugB * 0.5})`;
          ctx.lineWidth = 0.8;
          const px = x + CS / 2, py = y + CS / 2;
          for (let l = 0; l < 3; l++) {
            const la = -0.4 + l * 0.4;
            ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.lineTo(px - 6 * Math.cos(la), py + 4 * Math.sin(la)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px + 3, py); ctx.lineTo(px + 6 * Math.cos(la), py + 4 * Math.sin(la)); ctx.stroke();
          }
          ctx.restore();
        } else if (gs.map[r][c] === 4) {
          const glow = b * 0.15;
          if (glow > 0) {
            ctx.fillStyle = `rgba(34,211,238,${glow})`;
            ctx.fillRect(x, y, CS, CS);
          }
        }
      }
    }

    // Pulse ring
    if (gs.pulsing) {
      const ringAlpha = Math.max(0, 0.55 * (1 - gs.pulseAge / 700));
      if (ringAlpha > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(gs.pulseX, gs.pulseY, gs.pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168,85,247,${ringAlpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = 18;
        ctx.stroke();
        if (gs.pulseRadius > CS) {
          ctx.beginPath();
          ctx.arc(gs.pulseX, gs.pulseY, gs.pulseRadius - CS * 0.6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(168,85,247,${ringAlpha * 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 8;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Dim wall silhouettes
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        if (gs.map[r][c] === 1 && cellBrightness(gs, r, c, now) <= 0) {
          ctx.fillStyle = "rgba(10,3,18,0.6)";
          ctx.fillRect(c * CS, r * CS, CS, CS);
        }
      }
    }

    // Bat
    const flap = Math.sin(gs.wingT);
    const ang = Math.atan2(gs.faceDY, gs.faceDX);
    ctx.save();
    ctx.translate(gs.pixX, gs.pixY);
    ctx.rotate(ang - Math.PI / 2);
    const R = CS * 0.36;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.6);
    g.addColorStop(0, "rgba(192,132,252,0.32)");
    g.addColorStop(1, "rgba(192,132,252,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "#a855f7"; ctx.shadowBlur = 16;
    const ws = R * 1.8 + flap * R * 0.85, wh = R * 0.55 - flap * R * 0.28;
    ctx.fillStyle = "rgba(192,132,252,0.9)";
    ctx.beginPath(); ctx.moveTo(0, -R * 0.3); ctx.quadraticCurveTo(-ws, -wh, -ws * 0.38, R * 0.5); ctx.quadraticCurveTo(-R * 0.2, R * 0.1, 0, R * 0.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -R * 0.3); ctx.quadraticCurveTo(ws, -wh, ws * 0.38, R * 0.5); ctx.quadraticCurveTo(R * 0.2, R * 0.1, 0, R * 0.2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.36, R * 0.58, 0, 0, Math.PI * 2); ctx.fillStyle = "#c084fc"; ctx.fill();
    ctx.fillStyle = "#e879f9";
    ctx.beginPath(); ctx.moveTo(-R * 0.24, -R * 0.5); ctx.lineTo(-R * 0.44, -R * 0.98); ctx.lineTo(-R * 0.06, -R * 0.54); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R * 0.24, -R * 0.5); ctx.lineTo(R * 0.44, -R * 0.98); ctx.lineTo(R * 0.06, -R * 0.54); ctx.fill();
    ctx.fillStyle = "#fde68a"; ctx.shadowColor = "#fde68a"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(-R * 0.14, -R * 0.1, R * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.14, -R * 0.1, R * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }, [cellBrightness]);

  // ── Game loop ───────────────────────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    if (phaseRef.current !== "playing") return;
    const gs = gsRef.current;
    if (!gs) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dt = Math.min(ts - lastTsRef.current, 50);
    lastTsRef.current = ts;
    if (gs.gameStartTs === 0) gs.gameStartTs = ts;
    gs.elapsedMs = ts - gs.gameStartTs;
    gs.bugT += dt * 0.003;

    // Pulse timer
    if (!gs.pulsing && ts - gs.lastPulseTs >= PULSE_INTERVAL) {
      firePulse(gs, ts);
    }

    // Advance pulse ring
    if (gs.pulsing) {
      gs.pulseAge += dt;
      gs.pulseRadius = PULSE_SPEED * (gs.pulseAge / 1000) * CS;
      const ringTileR = gs.pulseRadius / CS;

      for (let r = 0; r < NR; r++) {
        for (let c = 0; c < NC; c++) {
          const dx = c - gs.tileC, dy = r - gs.tileR;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (gs.map[r][c] === 1 && d <= PULSE_MAX_TILES && Math.abs(d - ringTileR) < 1.2) {
            gs.tileLastLit[r][c] = ts;
          }
          if (gs.map[r][c] !== 1 && d <= PULSE_MAX_TILES && d <= ringTileR + 0.5 && d >= ringTileR - 2.5) {
            gs.tileLastLit[r][c] = ts;
          }
        }
      }

      if (ringTileR > PULSE_MAX_TILES) gs.pulsing = false;
    }

    // Always light bat's immediate neighbours
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = gs.tileR + dr, c = gs.tileC + dc;
        if (r >= 0 && r < NR && c >= 0 && c < NC) gs.tileLastLit[r][c] = ts;
      }
    }

    // Movement
    const step = gs.spd * CS * (dt / 1000);
    const target = tileCenter(gs.tileC, gs.tileR);
    const dxT = target.x - gs.pixX, dyT = target.y - gs.pixY;
    const dist = Math.sqrt(dxT * dxT + dyT * dyT);

    if (dist <= step) {
      gs.pixX = target.x; gs.pixY = target.y;
      let moved = false;
      for (const [dx, dy] of [[gs.qDX, gs.qDY], [gs.faceDX, gs.faceDY]]) {
        if (dx === 0 && dy === 0) continue;
        const nc = gs.tileC + dx, nr = gs.tileR + dy;
        if (!isWall(gs, nc, nr)) {
          gs.tileC = nc; gs.tileR = nr;
          gs.faceDX = dx; gs.faceDY = dy;
          moved = true;
          break;
        }
      }
      const wasMoving = gs.faceDX !== 0 || gs.faceDY !== 0;
      const playerTriedToMove = gs.qDX !== 0 || gs.qDY !== 0;
      if (!moved && wasMoving && playerTriedToMove) {
        draw(ctx, gs, ts);
        phaseRef.current = "dead";
        setPhase("dead");
        const bugPoints = gs.score * 100;
        onGameOver({
          coinsEarned: bugPoints,
          distance: 0,
          metadata: { score: bugPoints, bugPoints, timeBonus: 0, speedBonus: 0, secs: gs.elapsedMs / 1000, completed: false },
        });
        return;
      }
      if (moved && gs.map[gs.tileR][gs.tileC] === 4) {
        draw(ctx, gs, ts);
        phaseRef.current = "exit";
        setPhase("exit");
        return;
      }
      // Eat bug
      if (gs.map[gs.tileR]?.[gs.tileC] === 2) {
        gs.map[gs.tileR][gs.tileC] = 0;
        gs.score++;
        gs.eaten++;
        gs.spd = Math.min(BASE_SPD + gs.eaten * 0.25, MAX_SPD);
        firePulse(gs, ts);
      }
      if (gs.score >= gs.totalBugs) {
        draw(ctx, gs, ts);
        const fd = calcFinalScore(gs);
        setFinalData(fd);
        phaseRef.current = "won";
        setPhase("won");
        onGameOver({
          coinsEarned: fd.total,
          distance: 0,
          metadata: { score: fd.total, bugPoints: fd.bugPoints, timeBonus: fd.timeBonus, speedBonus: fd.speedBonus, secs: fd.secs, completed: true },
        });
        return;
      }
    } else {
      gs.pixX += dxT / dist * step;
      gs.pixY += dyT / dist * step;
    }

    // HUD
    const sinceLast = gs.pulsing ? 0 : Math.min(1, (ts - gs.lastPulseTs) / PULSE_INTERVAL);
    setHudScore(gs.score);
    setHudTime((gs.elapsedMs / 1000).toFixed(1) + "s");
    setHudSpeed((gs.spd / BASE_SPD).toFixed(1) + "x");
    setEchoPct(gs.pulsing ? 100 : (1 - sinceLast) * 100);

    draw(ctx, gs, ts);
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, onGameOver]);

  // ── Start / Restart ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const gs = initGame();
    gsRef.current = gs;
    phaseRef.current = "playing";
    setPhase("playing");
    setHudScore(0);
    setHudTime("0.0s");
    setHudSpeed("1.0x");
    setEchoPct(100);
    setFinalData(null);
    lastTsRef.current = performance.now();
    rafRef.current = requestAnimationFrame((ts) => {
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(loop);
    });
  }, [initGame, loop]);

  // ── Keyboard controls ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "playing") return;
      const gs = gsRef.current;
      if (!gs) return;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
        a: [-1, 0], A: [-1, 0], d: [1, 0], D: [1, 0], w: [0, -1], W: [0, -1], s: [0, 1], S: [0, 1],
      };
      if (map[e.key]) { [gs.qDX, gs.qDY] = map[e.key]; e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Touch / swipe controls on canvas ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let sx = 0, sy = 0;
    const onTouchStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      if (phaseRef.current !== "playing") return;
      const gs = gsRef.current;
      if (!gs) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) > Math.abs(dy)) { gs.qDX = dx > 0 ? 1 : -1; gs.qDY = 0; }
      else { gs.qDX = 0; gs.qDY = dy > 0 ? 1 : -1; }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Navigate to secret page after brief pause
  useEffect(() => {
    if (phase !== "exit") return;
    fetch("/api/achievements/echo-exit", { method: "POST" }).catch(() => {});
    const timer = setTimeout(() => router.push("/secret"), 1200);
    return () => clearTimeout(timer);
  }, [phase, router]);

  // ── D-Pad handler ─────────────────────────────────────────────────────────────
  const setDir = (dx: number, dy: number) => {
    if (phaseRef.current !== "playing") return;
    const gs = gsRef.current;
    if (gs) { gs.qDX = dx; gs.qDY = dy; }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* HUD */}
      <div className="w-full flex justify-between items-center px-2 text-xs font-mono tracking-widest uppercase">
        <div>
          <div className="text-purple-700 text-[9px]">BUGS</div>
          <div className="text-purple-300 text-sm">{hudScore}</div>
        </div>
        <div className="text-center">
          <div className="text-purple-700 text-[9px]">ECHO</div>
          <div className="w-20 h-1.5 bg-purple-950 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-purple-500 rounded-full transition-none"
              style={{ width: `${echoPct}%`, boxShadow: "0 0 6px #a855f7" }}
            />
          </div>
        </div>
        <div className="text-center">
          <div className="text-purple-700 text-[9px]">TIME</div>
          <div className="text-purple-300 text-sm">{hudTime}</div>
        </div>
        <div className="text-right">
          <div className="text-purple-700 text-[9px]">SPEED</div>
          <div className="text-purple-300 text-sm">{hudSpeed}</div>
        </div>
      </div>

      {/* Canvas wrapper */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={NC * CS}
          height={NR * CS}
          className="block rounded-xl border border-purple-900/40"
          style={{ imageRendering: "pixelated", maxWidth: "100%", aspectRatio: `${NC * CS} / ${NR * CS}` }}
        />

        {/* Start overlay */}
        {phase === "start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04020a]/95 rounded-xl z-10">
            <div className="text-5xl animate-pulse mb-1">🦇</div>
            <h2 className="text-purple-300 text-2xl font-bold tracking-widest mb-1">ECHOLOCATE</h2>
            <p className="text-purple-700 text-xs text-center max-w-[220px] leading-relaxed mb-4">
              Hunt every bug in the dark.<br />Each shriek lights the maze.
            </p>
            <p className="text-[10px] text-purple-900 tracking-widest mb-1">SWIPE · WASD · ARROWS</p>
            <button
              onClick={startGame}
              className="mt-3 px-8 py-2.5 border-2 border-purple-500 text-purple-300 text-sm tracking-widest font-mono uppercase hover:bg-purple-500/20 transition-colors rounded"
            >
              HUNT
            </button>
          </div>
        )}

        {/* Death overlay */}
        {phase === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04020a]/95 rounded-xl z-10">
            <h2 className="text-purple-300 text-3xl font-bold tracking-widest mb-2">SPLAT</h2>
            <p className="text-purple-700 text-xs text-center mb-5">
              You flew into a wall.<br />The bugs escape... for now.
            </p>
            <button
              onClick={startGame}
              className="px-8 py-2.5 border-2 border-purple-500 text-purple-300 text-sm tracking-widest font-mono uppercase hover:bg-purple-500/20 transition-colors rounded"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* Exit overlay */}
        {phase === "exit" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04020a]/98 rounded-xl z-10">
            <p className="text-cyan-400 text-sm font-mono tracking-[0.3em] animate-pulse">. . .</p>
          </div>
        )}

        {/* Win overlay */}
        {phase === "won" && finalData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04020a]/95 rounded-xl z-10 gap-1">
            <h2 className="text-purple-300 text-2xl font-bold tracking-widest">ALL CLEAR</h2>
            <p className="text-purple-700 text-xs mb-1">Every last bug devoured.</p>
            <div className="text-pink-300 text-3xl font-bold" style={{ textShadow: "0 0 20px #e879f9" }}>
              {finalData.total.toLocaleString()} PTS
            </div>
            <div className="text-purple-700 text-[10px] font-mono text-center leading-loose mt-1">
              {finalData.bugPoints} bugs × 100 = {finalData.bugPoints}<br />
              time ({finalData.secs.toFixed(1)}s) = +{finalData.timeBonus}<br />
              speed bonus = +{finalData.speedBonus}
            </div>
          </div>
        )}
      </div>

      {/* D-Pad (touch) */}
      <div className="relative w-40 h-40 mt-1 sm:hidden">
        {([
          ["▲", 0, -1, "top-0 left-[55px]"],
          ["▼", 0,  1, "bottom-0 left-[55px]"],
          ["◀", -1, 0, "top-[55px] left-0"],
          ["▶",  1, 0, "top-[55px] right-0"],
        ] as [string, number, number, string][]).map(([label, dx, dy, cls]) => (
          <button
            key={label}
            onPointerDown={(e) => { e.preventDefault(); setDir(dx, dy); }}
            className={`absolute w-12 h-12 ${cls} flex items-center justify-center text-purple-400 text-xl bg-purple-500/10 border border-purple-500/30 rounded-lg active:bg-purple-500/40`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
