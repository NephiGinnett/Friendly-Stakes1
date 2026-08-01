"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { GAME_REGISTRY } from "@/lib/gameRegistry";
import { formatPoints } from "@/lib/utils";
import type { GameOverPayload } from "@/components/games/types";

type GameProps = { onGameOver: (payload: GameOverPayload) => void };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GAME_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "echolocate": dynamic<GameProps>(() => import("@/components/games/Echolocate"), { ssr: false }),
  "paint-shop": dynamic<GameProps>(() => import("@/components/games/PaintShop"), { ssr: false }),
  "tap-forge": dynamic<GameProps>(() => import("@/components/games/TapForge"), { ssr: false }),
};

const ACHIEVEMENT_NAMES: Record<string, string> = {
  "echolocate": "Night Hunter",
  "paint-shop": "Exact Science",
  "tap-forge": "Master Smith",
};

type Phase = "pending" | "submitting" | "submitted";
type SubmitResult = { pointsEarned: number; dailyTotal: number; dailyCap: number; achievementUnlocked: boolean };

export default function GamePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const game = GAME_REGISTRY[slug as keyof typeof GAME_REGISTRY];

  const [ready, setReady] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [overlayPhase, setOverlayPhase] = useState<Phase | null>(null);
  const [pendingResult, setPendingResult] = useState<GameOverPayload | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayAchievement, setReplayAchievement] = useState(false);
  const [showSenders, setShowSenders] = useState(false);
  const [senders, setSenders] = useState<{ id: number; score: number; royalty: number; user: { id: number; username: string } }[]>([]);
  const [senderMsg, setSenderMsg] = useState("");
  const [senderLoading, setSenderLoading] = useState(false);
  const [hasSenderItem, setHasSenderItem] = useState(false);
  const [publishedScore, setPublishedScore] = useState<number | null>(null);
  const [publishRoyalty, setPublishRoyalty] = useState(50);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");

  const sessionIdRef = useRef<number | null>(null);

  const startSession = useCallback(async () => {
    try {
      const res = await fetch("/api/games/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: slug }),
      });
      if (!res.ok) throw new Error();
      const { sessionId } = await res.json();
      sessionIdRef.current = sessionId;
    } catch {
      setError("Couldn't start a game session. Please refresh.");
    }
  }, [slug]);

  const loadSenders = useCallback(() => {
    fetch(`/api/games/score-sender?gameId=${slug}`).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      setSenders(d.senders ?? []);
      setHasSenderItem(!!d.hasItem);
      const mine = (d.mySenders ?? []).find((m: { gameId: string; score: number; active: boolean }) => m.gameId === slug && m.active);
      setPublishedScore(mine ? mine.score : null);
    });
  }, [slug]);

  // Both of these must clear `publishing` on every path — an uncaught throw
  // (network drop, or a non-JSON error body from a 500) would otherwise leave
  // the button stuck on "Publishing…" forever with no way to retry.
  const publishScore = async () => {
    setPublishing(true); setPublishMsg("");
    try {
      const res = await fetch("/api/games/score-sender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", gameId: slug, royalty: publishRoyalty }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setPublishMsg(
          d.clamped
            ? `Published at the ${formatPoints(d.score)} ceiling (your ${formatPoints(d.rawScore)} still stands on the leaderboard) — ${d.royalty}% royalty!`
            : `Published ${formatPoints(d.score)} at ${d.royalty}% royalty!`
        );
        loadSenders();
      } else {
        setPublishMsg(d.error ?? "Couldn't publish");
      }
    } catch {
      setPublishMsg("Couldn't reach the server — try again.");
    } finally {
      setPublishing(false);
    }
  };

  const unpublishScore = async () => {
    setPublishing(true); setPublishMsg("");
    try {
      const res = await fetch("/api/games/score-sender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish", gameId: slug }),
      });
      if (res.ok) { setPublishMsg("Removed from the market."); loadSenders(); }
      else setPublishMsg("Couldn't remove it");
    } catch {
      setPublishMsg("Couldn't reach the server — try again.");
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) { router.push("/login"); return; }
      if (!game) { router.push("/games"); return; }
      startSession().then(() => setReady(true));
      loadSenders();
    });
  }, [router, game, startSession, loadSenders]);

  // Heartbeat
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible" || !sessionIdRef.current) return;
      fetch("/api/games/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleGameOver = useCallback((payload: GameOverPayload) => {
    setReplayAchievement(false);
    setPendingResult(payload);
    setOverlayPhase("pending");
  }, []);

  const handleSubmit = async () => {
    if (!pendingResult) return;
    setOverlayPhase("submitting");
    try {
      const res = await fetch("/api/games/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          coinsEarned: pendingResult.coinsEarned,
          metadata: pendingResult.metadata ?? {},
          submit: true,
        }),
      });
      if (!res.ok) throw new Error();
      const data: SubmitResult = await res.json();
      setSubmitResult(data);
      setOverlayPhase("submitted");
    } catch {
      setError("Submission failed — please try again.");
      setOverlayPhase("pending");
    }
  };

  const handleReplay = async () => {
    // Abandon current session (coins already saved to localStorage by game component)
    if (sessionIdRef.current) {
      const res = await fetch("/api/games/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          coinsEarned: pendingResult?.coinsEarned ?? 0,
          metadata: pendingResult?.metadata ?? {},
          submit: false,
        }),
      }).then((r) => r.json()).catch(() => ({}));
      if (res.achievementUnlocked) setReplayAchievement(true);
    }

    await startSession();
    setPendingResult(null);
    setSubmitResult(null);
    setOverlayPhase(null);
    setError(null);
    setGameKey((k) => k + 1);
  };

  if (!game) return null;

  const GameComponent = GAME_COMPONENTS[slug];
  const showOverlay = overlayPhase !== null;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/games" className="text-slate-400 hover:text-white text-sm transition-colors">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white leading-tight">
              {game.emoji} {game.name}
            </h1>
            <p className="text-slate-500 text-xs">Up to {game.dailyCap} pts/day</p>
          </div>
          <Link
            href={`/games/${slug}/leaderboard`}
            className="text-slate-500 hover:text-violet-400 text-sm transition-colors"
            title="Leaderboard"
          >
            📊
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!ready && !error && (
          <div className="text-center text-slate-500 py-12">Loading…</div>
        )}

        {ready && !showOverlay && GameComponent && (
          <>
            {replayAchievement && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🏅</span>
                <div>
                  <div className="text-yellow-300 font-semibold text-sm">Achievement unlocked: {game.emoji} {ACHIEVEMENT_NAMES[slug] ?? "New Achievement"}!</div>
                  <Link href="/achievements" className="text-yellow-600 text-xs hover:text-yellow-400 transition-colors">Claim your reward →</Link>
                </div>
              </div>
            )}
            <GameComponent key={gameKey} onGameOver={handleGameOver} />
          </>
        )}

        {showOverlay && (
          <div className="space-y-4">
            {overlayPhase === "pending" && pendingResult && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-center text-slate-300 font-semibold">
                  {slug === "echolocate" ? (pendingResult.metadata?.completed ? "Level cleared! 🦇" : "You died! 🦇") :
                   slug === "paint-shop" ? "Day complete! 🌅" :
                   slug === "tap-forge" ? "Forge closed! 🔨" :
                   `${game.emoji} Game over!`}
                </div>
                <div className="space-y-2 text-sm">
                  {slug === "echolocate" && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Final score</span>
                      <span className="text-purple-400 font-semibold">{pendingResult.coinsEarned.toLocaleString()} pts</span>
                    </div>
                  )}
                  {slug === "paint-shop" && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Earned this shift</span>
                      <span className="text-green-400 font-semibold">${pendingResult.coinsEarned}</span>
                    </div>
                  )}
                  {slug === "tap-forge" && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Coins forged</span>
                      <span className="text-amber-400 font-semibold">🪙 {pendingResult.coinsEarned.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/10 pt-2">
                    <span className="text-slate-400">Worth up to</span>
                    <span className="text-violet-400 font-semibold">
                      {Math.floor(pendingResult.coinsEarned / game.conversionRate)} pts
                    </span>
                  </div>
                </div>
              </div>
            )}

            {overlayPhase === "submitting" && (
              <div className="text-center text-slate-400 py-6 text-sm animate-pulse">Submitting…</div>
            )}

            {overlayPhase === "submitted" && submitResult && (
              <div className="space-y-3">
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-6 text-center space-y-2">
                  <div className="text-3xl">🎉</div>
                  <div className="text-white font-bold text-xl">
                    +{submitResult.pointsEarned} pts!
                  </div>
                  <div className="text-slate-400 text-sm">
                    {submitResult.dailyTotal} / {submitResult.dailyCap} pts today
                  </div>
                  {submitResult.dailyTotal >= submitResult.dailyCap && (
                    <div className="text-yellow-400 text-xs pt-1">
                      Daily cap reached — come back tomorrow!
                    </div>
                  )}
                </div>
                {submitResult.achievementUnlocked && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl">🏅</span>
                    <div>
                      <div className="text-yellow-300 font-semibold text-sm">Achievement unlocked: {game.emoji} {ACHIEVEMENT_NAMES[slug] ?? "New Achievement"}!</div>
                      <Link href="/achievements" className="text-yellow-600 text-xs hover:text-yellow-400 transition-colors">
                        Claim your reward →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {overlayPhase === "pending" && (
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Submit Score
                </button>
              )}
              <button
                onClick={handleReplay}
                disabled={overlayPhase === "submitting"}
                className={`flex-1 py-3.5 font-bold rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  overlayPhase === "submitted"
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-white/10 hover:bg-white/15 text-slate-300"
                }`}
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Publish/manage your score (works on every game — spend a Score Sender item) */}
        {(hasSenderItem || publishedScore !== null) && !showOverlay && (
          <div className="mt-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/25 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">📡 Publish your {game.name} score</p>
              {publishedScore !== null && (
                <span className="text-xs text-emerald-400">Live: {formatPoints(publishedScore)} {game.leaderboardLabel.toLowerCase()}</span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Publishes your best {game.name} run so other players can cash it in — you earn the royalty % each time. Uses one Score Sender item. Remove it anytime to keep the market clear.
            </p>
            {hasSenderItem && (
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400 whitespace-nowrap">Royalty: <span className="text-white font-semibold">{publishRoyalty}%</span></label>
                <input type="range" min={10} max={90} step={5} value={publishRoyalty}
                  onChange={(e) => setPublishRoyalty(parseInt(e.target.value))}
                  className="flex-1 accent-emerald-500" />
              </div>
            )}
            <div className="flex gap-2">
              {hasSenderItem && (
                <button onClick={publishScore} disabled={publishing}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                  {publishing ? "Publishing…" : publishedScore !== null ? "Update published score" : "Publish score"}
                </button>
              )}
              {publishedScore !== null && (
                <button onClick={unpublishScore} disabled={publishing}
                  className={`${hasSenderItem ? "px-4" : "flex-1"} py-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-sm font-semibold transition-colors disabled:opacity-50`}>
                  Remove from market
                </button>
              )}
            </div>
            {publishMsg && <p className="text-xs text-center text-emerald-400">{publishMsg}</p>}
          </div>
        )}

        {/* Score Sender section */}
        {senders.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowSenders(v => !v)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <span>📡 Score Senders ({senders.length})</span>
              <span>{showSenders ? "▲" : "▼"}</span>
            </button>
            {showSenders && (
              <div className="mt-2 space-y-2">
                {senderMsg && <p className="text-xs text-emerald-400 text-center">{senderMsg}</p>}
                {senders.map(s => {
                  const scorePts = Math.floor(s.score / game.conversionRate);
                  const playerPts = scorePts - Math.floor(scorePts * s.royalty / 100);
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="text-sm text-white font-medium">{s.user.username}</p>
                        <p className="text-xs text-slate-500">{formatPoints(s.score)} {game.leaderboardLabel.toLowerCase()} · {s.royalty}% royalty</p>
                      </div>
                      <button
                        onClick={async () => {
                          setSenderLoading(true); setSenderMsg("");
                          const res = await fetch("/api/games/score-sender", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "use", senderId: s.id }),
                          });
                          const d = await res.json();
                          setSenderLoading(false);
                          if (res.ok) setSenderMsg(`+${d.pointsEarned} pts (${d.royaltyPaid} royalty to ${s.user.username})`);
                          else setSenderMsg(d.error ?? "Failed");
                        }}
                        disabled={senderLoading}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        Use → +{formatPoints(playerPts)} pts
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
