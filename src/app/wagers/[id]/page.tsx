"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints, formatDate, timeUntil, getStatusBg } from "@/lib/utils";
import { playWinSound } from "@/lib/sounds";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Vote = { id: number; userId: number; choice: string; user: { id: number; username: string } };
type WagerEntry = {
  id: number; userId: number; side: string; stake: number; lockedPayout: number; createdAt: string;
  user: { id: number; username: string };
};
type BotEntry = { id: number; side: string; stake: number; botType: string };
type Wager = {
  id: number; title: string; description: string | null; creatorPosition: string;
  creatorStake: number; creatorLockedPayout: number; deadline: string; status: string;
  winnerSide: string | null; settledBy: string | null; settledAt: string | null;
  vpnActive: boolean; vpnMasked: boolean;
  isPublic: boolean;
  publicFavorForVotes: number; publicFavorForPts: number;
  publicFavorAgainstVotes: number; publicFavorAgainstPts: number;
  creator: { id: number; username: string };
  entries: WagerEntry[];
  votes: Vote[];
  botEntries: BotEntry[];
};

export default function WagerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [wager, setWager] = useState<Wager | null>(null);
  const [joinSide, setJoinSide] = useState<"for" | "against">("against");
  const [joinStake, setJoinStake] = useState("");
  const [loading, setLoading] = useState("");
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [useThumb, setUseThumb] = useState(false);
  const [thumbUsesLeft, setThumbUsesLeft] = useState(0);
  const [useVpn, setUseVpn] = useState(false);
  const [hasVpn, setHasVpn] = useState(false);

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch(`/api/wagers/${params.id}`).then((r) => r.json()).then(setWager);
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      const owned = d.owned ?? [];
      const thumb = owned.find((i: { itemType: string; usesLeft: number }) => i.itemType === "thumb");
      setThumbUsesLeft(thumb?.usesLeft ?? 0);
      setHasVpn(owned.some((i: { itemType: string; usesLeft: number }) => i.itemType === "temp_vpn" && i.usesLeft > 0));
    });
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch(`/api/wagers/${params.id}`)
      .then((r) => { if (!r.ok) { router.push("/feed"); return null; } return r.json(); })
      .then(setWager);
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      const owned = d.owned ?? [];
      const thumb = owned.find((i: { itemType: string; usesLeft: number }) => i.itemType === "thumb");
      setThumbUsesLeft(thumb?.usesLeft ?? 0);
      setHasVpn(owned.some((i: { itemType: string; usesLeft: number }) => i.itemType === "temp_vpn" && i.usesLeft > 0));
    });
  }, [params.id, router]);

  // Play win sound when user taps the settled result
  const handleSettledClick = () => {
    if (soundPlayed) return;
    if (!user || !wager || wager.status !== "settled" || !wager.winnerSide) return;

    const userIsCreator = user.id === wager.creator.id;
    const entry = wager.entries.find((e) => e.userId === user.id);
    const mySide = userIsCreator ? "for" : entry?.side;

    if (mySide === wager.winnerSide) {
      playWinSound();
      setSoundPlayed(true);
    }
  };

  if (!user || !wager) return null;

  const isCreator = user.id === wager.creator.id;
  const myEntry = wager.entries.find((e) => e.userId === user.id);
  const isParticipant = isCreator || !!myEntry;
  const userVote = wager.votes.find((v) => v.userId === user.id);

  const forEntries = wager.entries.filter((e) => e.side === "for");
  const againstEntries = wager.entries.filter((e) => e.side === "against");
  const masked = wager.vpnMasked;
  const unnamedForBots = wager.botEntries.filter((b) => b.side === "for" && b.botType === "unnamed");
  const unnamedAgainstBots = wager.botEntries.filter((b) => b.side === "against" && b.botType === "unnamed");
  const namedForBots = wager.botEntries.filter((b) => b.side === "for" && b.botType !== "unnamed");
  const namedAgainstBots = wager.botEntries.filter((b) => b.side === "against" && b.botType !== "unnamed");
  const botForTotal = wager.botEntries.filter((b) => b.side === "for").reduce((s, b) => s + b.stake, 0);
  const botAgainstTotal = wager.botEntries.filter((b) => b.side === "against").reduce((s, b) => s + b.stake, 0);
  const forTotal = wager.creatorStake + forEntries.reduce((sum, e) => sum + e.stake, 0) + botForTotal;
  const againstTotal = againstEntries.reduce((sum, e) => sum + e.stake, 0) + botAgainstTotal;
  const totalPool = forTotal + againstTotal;
  const pts = (n: number) => masked ? "???" : formatPoints(n);

  // Odds helpers (public wagers)
  function simplifyOdds(a: number, b: number): string {
    if (a === 0 && b === 0) return "1:1";
    if (b === 0) return "—:1";
    if (a === 0) return "1:—";
    const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
    const g = gcd(a, b);
    let ra = a / g, rb = b / g;
    const max = Math.max(ra, rb);
    if (max > 20) {
      const scale = max / 10;
      ra = Math.max(1, Math.round(ra / scale));
      rb = Math.max(1, Math.round(rb / scale));
    }
    return `${ra}:${rb}`;
  }
  function lockedReturn(stake: number, ownPool: number, opposingPool: number): number {
    if (opposingPool === 0) return stake;
    return stake + Math.floor((stake / ownPool) * opposingPool);
  }
  const stakeNum = parseInt(joinStake) || 0;
  const previewForReturn = stakeNum > 0 ? lockedReturn(stakeNum, forTotal + stakeNum, againstTotal) : 0;
  const previewAgainstReturn = stakeNum > 0 ? lockedReturn(stakeNum, againstTotal + stakeNum, forTotal) : 0;

  const forVotes = wager.votes.filter((v) => v.choice === "for").length;
  const againstVotes = wager.votes.filter((v) => v.choice === "against").length;

  const handleJoin = async () => {
    const stakeNum = parseInt(joinStake);
    if (!stakeNum) return;
    setLoading("join");
    const res = await fetch(`/api/wagers/${wager.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: joinSide, stake: stakeNum, useVpn: useVpn || undefined }),
    });
    setLoading("");
    if (res.ok) { setJoinStake(""); setUseVpn(false); fetchData(); }
    else { const d = await res.json(); alert(d.error); }
  };

  const handleStart = async () => {
    setLoading("start");
    const res = await fetch(`/api/wagers/${wager.id}/start`, { method: "POST" });
    setLoading("");
    if (res.ok) fetchData();
    else { const d = await res.json(); alert(d.error); }
  };

  const handleVote = async (choice: string) => {
    setLoading("vote");
    await fetch(`/api/wagers/${wager.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice, useThumb }),
    });
    setLoading("");
    setUseThumb(false);
    fetchData();
  };

  const handleCloseEarly = async () => {
    setLoading("close");
    await fetch(`/api/wagers/${wager.id}/close-early`, { method: "POST" });
    setLoading("");
    fetchData();
  };

  const handleAdminSettle = async (winnerSide: string) => {
    setLoading("settle");
    await fetch(`/api/wagers/${wager.id}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerSide }),
    });
    setLoading("");
    fetchData();
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/feed")} className="text-slate-400 hover:text-white text-sm">
            &larr; Back
          </button>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Header */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-xl font-bold text-white">{wager.title}</h2>
            <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBg(wager.status)}`}>
              {wager.status}
            </span>
          </div>
          {wager.description && (
            <p className="text-sm text-slate-400 mb-3">{wager.description}</p>
          )}
          <p className="text-sm text-slate-300 mb-3">
            <span className="text-violet-400 font-medium">{wager.creator.username}</span> says:{" "}
            <span className="italic">&quot;{wager.creatorPosition}&quot;</span>
          </p>
          <p className="text-xs text-slate-500">
            Deadline: {formatDate(wager.deadline)} ({timeUntil(wager.deadline)})
          </p>
        </div>

        {/* Public wager odds bar */}
        {wager.isPublic && (
          <div className="card bg-emerald-500/5 border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">📈 Public Market</p>
              <p className="text-xs text-slate-500 font-mono">{1 + forEntries.length + againstEntries.length} bettors</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-violet-500/10 py-2 px-3">
                <p className="text-xs text-slate-500">FOR odds</p>
                <p className="text-lg font-bold font-mono text-violet-300">{simplifyOdds(forTotal, againstTotal)}</p>
              </div>
              <div className="rounded-xl bg-rose-500/10 py-2 px-3">
                <p className="text-xs text-slate-500">AGAINST odds</p>
                <p className="text-lg font-bold font-mono text-rose-300">{simplifyOdds(againstTotal, forTotal)}</p>
              </div>
            </div>
            {stakeNum > 0 && (
              <div className="grid grid-cols-2 gap-2 text-center text-xs text-slate-400">
                <p>Bet {stakeNum} FOR → <span className="text-violet-300 font-semibold">lock {formatPoints(previewForReturn)} pts</span></p>
                <p>Bet {stakeNum} AGAINST → <span className="text-rose-300 font-semibold">lock {formatPoints(previewAgainstReturn)} pts</span></p>
              </div>
            )}
          </div>
        )}

        {/* Sides breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {/* For side */}
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide">For</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-violet-300 font-medium">{wager.creator.username}</span>
                <span className="text-slate-300">{pts(wager.creatorStake)}</span>
              </div>
              {forEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{e.user.username}</span>
                  <span className="text-slate-400">{pts(e.stake)}</span>
                </div>
              ))}
              {wager.isPublic && wager.publicFavorForVotes > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-600 italic">
                  <span>Public Favor: {wager.publicFavorForVotes.toLocaleString()} vote{wager.publicFavorForVotes !== 1 ? "s" : ""}</span>
                  <span>{wager.publicFavorForPts.toLocaleString()} pts</span>
                </div>
              )}
              {wager.isPublic && namedForBots.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>XX-Gambler</span>
                  <span>{pts(b.stake)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-violet-400 font-medium pt-1 border-t border-white/5">
              Total: {pts(forTotal)} pts
            </p>
          </div>

          {/* Against side */}
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide">Against</p>
            {againstEntries.length === 0 && botAgainstTotal === 0 ? (
              <p className="text-xs text-slate-500 py-2">Nobody yet</p>
            ) : (
              <div className="space-y-1.5">
                {againstEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{e.user.username}</span>
                    <span className="text-slate-400">{pts(e.stake)}</span>
                  </div>
                ))}
                {wager.isPublic && wager.publicFavorAgainstVotes > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-600 italic">
                    <span>Public Favor: {wager.publicFavorAgainstVotes.toLocaleString()} vote{wager.publicFavorAgainstVotes !== 1 ? "s" : ""}</span>
                    <span>{wager.publicFavorAgainstPts.toLocaleString()} pts</span>
                  </div>
                )}
                {wager.isPublic && namedAgainstBots.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs text-slate-600">
                    <span>XX-Gambler</span>
                    <span>{pts(b.stake)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-rose-400 font-medium pt-1 border-t border-white/5">
              Total: {pts(againstTotal)} pts
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 -mt-2">
          {wager.isPublic ? "" : `Total pool: ${pts(totalPool)} pts`}
          {masked && <span className="ml-1 text-violet-500">(🕵️ VPN active)</span>}
        </p>

        {/* JOIN — open wager, not creator, not already joined */}
        {wager.status === "open" && !isCreator && !myEntry && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Join this wager</h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setJoinSide("for")}
                className={`p-3 rounded-xl text-sm font-medium transition-all ${
                  joinSide === "for"
                    ? "bg-violet-600 text-white ring-2 ring-violet-400"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                For
                <p className="text-xs font-normal opacity-70 mt-0.5">I agree with {wager.creator.username}</p>
              </button>
              <button
                onClick={() => setJoinSide("against")}
                className={`p-3 rounded-xl text-sm font-medium transition-all ${
                  joinSide === "against"
                    ? "bg-rose-600 text-white ring-2 ring-rose-400"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                Against
                <p className="text-xs font-normal opacity-70 mt-0.5">I think they&apos;re wrong</p>
              </button>
            </div>

            <div>
              <label className="label">Your stake (you have {formatPoints(user.points)} pts)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input flex-1"
                  placeholder="How many points?"
                  min={1}
                  max={user.points}
                  value={joinStake}
                  onChange={(e) => setJoinStake(e.target.value)}
                />
                <button
                  onClick={handleJoin}
                  disabled={!joinStake || loading === "join"}
                  className={joinSide === "for" ? "btn-primary" : "btn-danger"}
                >
                  {loading === "join" ? "..." : "Join"}
                </button>
              </div>
              {wager.isPublic && stakeNum > 0 && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono space-y-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Current odds</span>
                    <span className="text-white">{simplifyOdds(forTotal, againstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>If you win</span>
                    <span className={joinSide === "for" ? "text-violet-300 font-bold" : "text-rose-300 font-bold"}>
                      {formatPoints(joinSide === "for" ? previewForReturn : previewAgainstReturn)} pts
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Net profit</span>
                    <span>
                      +{formatPoints((joinSide === "for" ? previewForReturn : previewAgainstReturn) - stakeNum)} pts
                    </span>
                  </div>
                </div>
              )}
            </div>

            {hasVpn && !wager.vpnActive && (
              <button
                type="button"
                onClick={() => setUseVpn((v) => !v)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-sm font-medium ${
                  useVpn
                    ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <span className="text-xl">🕵️</span>
                <div className="text-left">
                  <p>{useVpn ? "Temporary VPN — ACTIVE" : "Use Temporary VPN?"}</p>
                  <p className="text-xs opacity-70">Observers see aliases and ??? for amounts · consumes 1 charge</p>
                </div>
                <span className="ml-auto">{useVpn ? "✓" : "○"}</span>
              </button>
            )}
            {wager.vpnActive && (
              <p className="text-xs text-violet-400 font-mono text-center">🕵️ VPN already active on this wager</p>
            )}
          </div>
        )}

        {/* Already joined message */}
        {wager.status === "open" && myEntry && (
          <div className={`card text-center ${myEntry.side === "for" ? "border-violet-500/30" : "border-rose-500/30"}`}>
            <p className={`font-medium ${myEntry.side === "for" ? "text-violet-300" : "text-rose-300"}`}>
              You&apos;re in! ({myEntry.side === "for" ? "For" : "Against"} · {formatPoints(myEntry.stake)} pts)
            </p>
            {wager.isPublic && myEntry.lockedPayout > 0 && (
              <p className="text-xs text-emerald-400 mt-1">
                Locked return if you win: <span className="font-bold">{formatPoints(myEntry.lockedPayout)} pts</span>
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">Waiting for the creator to start the wager.</p>
          </div>
        )}

        {/* Creator live odds — public wagers only */}
        {wager.isPublic && isCreator && wager.status === "open" && (
          <div className="card border-violet-500/20 space-y-1.5">
            <p className="text-xs font-mono text-violet-400 uppercase tracking-widest">Your position (FOR · {formatPoints(wager.creatorStake)} pts)</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mt-1">
              <div className="bg-white/5 rounded-lg py-2">
                <p className="text-slate-500 mb-0.5">Odds</p>
                <p className="text-white font-bold">{simplifyOdds(forTotal, againstTotal)}</p>
              </div>
              <div className="bg-white/5 rounded-lg py-2">
                <p className="text-slate-500 mb-0.5">If you win now</p>
                <p className="text-violet-300 font-bold">{formatPoints(lockedReturn(wager.creatorStake, forTotal, againstTotal))} pts</p>
              </div>
              <div className="bg-white/5 rounded-lg py-2">
                <p className="text-slate-500 mb-0.5">Net profit</p>
                <p className="text-emerald-400 font-bold">+{formatPoints(lockedReturn(wager.creatorStake, forTotal, againstTotal) - wager.creatorStake)} pts</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 text-center">Your payout recalculates at close — this updates live as bettors join.</p>
          </div>
        )}

        {/* START button — creator/admin only, open status, need at least one against */}
        {wager.status === "open" && (isCreator || user.isAdmin) && (
          <div className="card space-y-3">
            <h3 className="font-semibold text-white">Ready to lock it in?</h3>
            {againstEntries.length === 0 ? (
              <p className="text-sm text-slate-500">Need at least one person on the &quot;against&quot; side before you can start.</p>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  {1 + forEntries.length} for · {againstEntries.length} against
                </p>
                <button
                  onClick={handleStart}
                  disabled={loading === "start"}
                  className="btn-success w-full"
                >
                  {loading === "start" ? "Starting..." : "Start Wager — Lock It In"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Close early — started status, participants/admin */}
        {wager.status === "started" && (isParticipant || user.isAdmin) && (
          <div className="card text-center space-y-2">
            <p className="text-sm text-slate-400">The event is over early?</p>
            <button
              onClick={handleCloseEarly}
              disabled={loading === "close"}
              className="btn-ghost w-full"
            >
              {loading === "close" ? "Closing..." : "Close Early & Start Voting"}
            </button>
          </div>
        )}

        {/* Voting */}
        {wager.status === "voting" && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Vote — who was right?</h3>
            <p className="text-sm text-slate-400">
              Settles automatically once 2+ votes agree on the same side.
            </p>

            {thumbUsesLeft > 0 && (
              <button
                onClick={() => setUseThumb((v) => !v)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-sm font-medium ${
                  useThumb
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <span className="text-xl">👍</span>
                <div className="text-left">
                  <p>{useThumb ? "Thumb on the Scale — ACTIVE" : "Use Thumb on the Scale?"}</p>
                  <p className="text-xs opacity-70">{thumbUsesLeft} use{thumbUsesLeft !== 1 ? "s" : ""} left · Your vote will count double</p>
                </div>
                <span className="ml-auto">{useThumb ? "✓" : "○"}</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote("for")}
                disabled={loading === "vote"}
                className={`p-3 rounded-xl text-center transition-all ${
                  userVote?.choice === "for"
                    ? "bg-violet-600 text-white ring-2 ring-violet-400"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <p className="text-sm font-medium">For wins</p>
                <p className="text-xs text-slate-400 mt-0.5">{forVotes} vote{forVotes !== 1 ? "s" : ""}</p>
              </button>
              <button
                onClick={() => handleVote("against")}
                disabled={loading === "vote"}
                className={`p-3 rounded-xl text-center transition-all ${
                  userVote?.choice === "against"
                    ? "bg-rose-600 text-white ring-2 ring-rose-400"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <p className="text-sm font-medium">Against wins</p>
                <p className="text-xs text-slate-400 mt-0.5">{againstVotes} vote{againstVotes !== 1 ? "s" : ""}</p>
              </button>
            </div>
            {wager.votes.length > 0 && (
              <div className="text-xs text-slate-500 space-y-0.5">
                {wager.votes.map((v) => (
                  <p key={v.id}>
                    {v.user.username} →{" "}
                    <span className={v.choice === "for" ? "text-violet-400" : "text-rose-400"}>
                      {v.choice}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin settle override */}
        {user.isAdmin &&
          wager.status !== "settled" &&
          wager.status !== "cancelled" &&
          wager.status !== "open" &&
          againstEntries.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-amber-400">Admin: Force Settle</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAdminSettle("for")}
                  disabled={loading === "settle"}
                  className="btn-primary"
                >
                  For side wins
                </button>
                <button
                  onClick={() => handleAdminSettle("against")}
                  disabled={loading === "settle"}
                  className="btn-danger"
                >
                  Against side wins
                </button>
              </div>
            </div>
          )}

        {/* Settled result */}
        {wager.status === "settled" && (
          <div
            className="card text-center space-y-3 cursor-pointer active:scale-95 transition-transform"
            onClick={handleSettledClick}
          >
            <p className={`font-bold text-lg ${wager.winnerSide === "for" ? "text-violet-300" : "text-rose-300"}`}>
              {wager.winnerSide === "for" ? "For" : "Against"} side won!
            </p>
            <p className="text-sm text-slate-400">
              Settled by {wager.settledBy}
            </p>
            <p className="text-xs text-slate-500">
              Votes: <span className="text-violet-400">{forVotes} for</span>
              {" · "}
              <span className="text-rose-400">{againstVotes} against</span>
            </p>
            {wager.settledAt && (
              <p className="text-xs text-slate-500">{formatDate(wager.settledAt)}</p>
            )}
            {!soundPlayed && (() => {
              const userIsCreator = user.id === wager.creator.id;
              const entry = wager.entries.find((e) => e.userId === user.id);
              const mySide = userIsCreator ? "for" : entry?.side;
              return mySide === wager.winnerSide
                ? <p className="text-xs text-violet-400 animate-pulse">Tap to celebrate! 🎉</p>
                : null;
            })()}
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
