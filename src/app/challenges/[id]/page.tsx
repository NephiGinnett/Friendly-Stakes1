"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints, formatDate } from "@/lib/utils";

const CHALLENGE_FEE = 50;

type User = { id: number; username: string; points: number; isAdmin: boolean };
type ChallengeVote = { id: number; userId: number; choice: string; weight: number; user: { id: number; username: string } };
type Challenge = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  offer: number;
  multiplier: number;
  vpnActive: boolean;
  vpnMasked: boolean;
  targetId: number | null;
  acceptedById: number | null;
  winnerUserId: number | null;
  settledAt: string | null;
  createdAt: string;
  creator: { id: number; username: string };
  target: { id: number; username: string } | null;
  acceptedBy: { id: number; username: string } | null;
  votes: ChallengeVote[];
};

const statusColor = (s: string) => {
  if (s === "pending") return "text-amber-300 bg-amber-500/20";
  if (s === "active") return "text-emerald-300 bg-emerald-500/20";
  if (s === "voting") return "text-violet-300 bg-violet-500/20";
  if (s === "settled") return "text-slate-400 bg-slate-500/20";
  return "text-slate-500 bg-slate-500/10";
};

export default function ChallengeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState("");
  const [useThumb, setUseThumb] = useState(false);
  const [thumbUsesLeft, setThumbUsesLeft] = useState(0);
  const [useVpn, setUseVpn] = useState(false);
  const [hasVpn, setHasVpn] = useState(false);

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch(`/api/challenges/${params.id}`).then((r) => r.json()).then(setChallenge);
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      const thumb = (d.owned ?? []).find((i: { itemType: string; usesLeft: number }) => i.itemType === "thumb");
      setThumbUsesLeft(thumb?.usesLeft ?? 0);
      setHasVpn((d.owned ?? []).some((i: { itemType: string; usesLeft: number }) => i.itemType === "temp_vpn" && i.usesLeft > 0));
    });
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch(`/api/challenges/${params.id}`)
      .then((r) => { if (!r.ok) { router.push("/challenges"); return null; } return r.json(); })
      .then(setChallenge);
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      const thumb = (d.owned ?? []).find((i: { itemType: string; usesLeft: number }) => i.itemType === "thumb");
      setThumbUsesLeft(thumb?.usesLeft ?? 0);
      setHasVpn((d.owned ?? []).some((i: { itemType: string; usesLeft: number }) => i.itemType === "temp_vpn" && i.usesLeft > 0));
    });
  }, [params.id, router]);

  const action = async (path: string, body?: object) => {
    setLoading(path);
    await fetch(`/api/challenges/${params.id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading("");
    fetchData();
  };

  const vote = async (choice: "completed" | "incomplete") => {
    setLoading(`vote-${choice}`);
    await fetch(`/api/challenges/${params.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice, useThumb }),
    });
    setLoading("");
    setUseThumb(false);
    fetchData();
  };

  if (!user || !challenge) return null;

  const isCreator = user.id === challenge.creator.id;
  const isTarget = challenge.targetId ? user.id === challenge.targetId : false;
  const isAcceptor = challenge.acceptedById ? user.id === challenge.acceptedById : false;
  const isParticipant = isCreator || isAcceptor;
  const canAccept = !isCreator && challenge.status === "pending" &&
    (challenge.targetId === null || isTarget);
  const myVote = challenge.votes.find((v) => v.userId === user.id);

  const masked = challenge.vpnMasked;
  const pts = (n: number) => masked ? "???" : formatPoints(n);
  const basePayout = challenge.offer - CHALLENGE_FEE;
  const netPayout = basePayout * challenge.multiplier;

  const completedW = challenge.votes.filter((v) => v.choice === "completed").reduce((s, v) => s + v.weight, 0);
  const incompleteW = challenge.votes.filter((v) => v.choice === "incomplete").reduce((s, v) => s + v.weight, 0);

  const winnerName = challenge.winnerUserId
    ? (challenge.winnerUserId === challenge.creator.id
      ? challenge.creator.username
      : challenge.acceptedBy?.username ?? "?")
    : null;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/challenges")} className="text-slate-400 hover:text-white text-sm">
            &larr; Board
          </button>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Header card */}
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-white">{challenge.title}</h2>
            <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(challenge.status)}`}>
              {challenge.status}
            </span>
          </div>
          {challenge.description && <p className="text-sm text-slate-400">{challenge.description}</p>}

          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <div>
              <p className="text-xs text-slate-500">Posted by <span className="text-slate-300">{challenge.creator.username}</span></p>
              <p className="text-xs text-slate-600 mt-0.5">{formatDate(challenge.createdAt)}</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${challenge.multiplier > 1 ? "text-amber-300" : "text-violet-300"}`}>
                {pts(netPayout)} pts
              </p>
              {!masked && challenge.multiplier > 1 && (
                <p className="text-xs text-amber-400">×{challenge.multiplier} bonus active!</p>
              )}
              <p className="text-xs text-slate-600">{pts(challenge.offer)} escrowed · {CHALLENGE_FEE} pt fee</p>
              {challenge.vpnActive && <p className="text-xs text-violet-400 mt-0.5">🕵️ VPN active</p>}
            </div>
          </div>

          {challenge.target && (
            <p className="text-xs text-amber-400">🎯 Targeted at {challenge.target.username}</p>
          )}
          {challenge.acceptedBy && (
            <p className="text-xs text-emerald-400">✓ Accepted by {challenge.acceptedBy.username}</p>
          )}
        </div>

        {/* Accept */}
        {canAccept && (
          <div className="card space-y-3">
            <p className="font-semibold text-white">Take this challenge?</p>
            <p className="text-sm text-slate-400">
              You&apos;ll earn <span className="text-violet-300 font-semibold">{pts(netPayout)}</span> if the group agrees you completed it.
              {!masked && challenge.multiplier > 1 && (
                <span className="text-amber-300"> ({challenge.multiplier}x multiplier active!)</span>
              )}
            </p>
            {challenge.vpnActive ? (
              <p className="text-xs text-violet-400">🕵️ VPN already active on this challenge</p>
            ) : hasVpn && (
              <button
                type="button"
                onClick={() => setUseVpn((v) => !v)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-sm font-medium ${
                  useVpn ? "bg-violet-500/20 border-violet-500/50 text-violet-300" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
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
            <button
              onClick={() => action("accept", useVpn ? { useVpn: true } : undefined)}
              disabled={loading === "accept"}
              className="btn-primary w-full"
            >
              {loading === "accept" ? "Accepting..." : "Accept Challenge"}
            </button>
          </div>
        )}

        {/* Targeted, pending, not you */}
        {challenge.status === "pending" && challenge.targetId && !isTarget && !isCreator && (
          <div className="card text-center py-4 text-slate-500 text-sm">
            This challenge is targeted at {challenge.target?.username}.
          </div>
        )}

        {/* Creator: cancel while pending */}
        {challenge.status === "pending" && isCreator && (
          <div className="card text-center space-y-2">
            <p className="text-sm text-slate-400">Waiting for someone to accept.</p>
            <button
              onClick={() => action("decline")}
              disabled={loading === "decline"}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors"
            >
              Cancel & get my {pts(challenge.offer)} back
            </button>
          </div>
        )}

        {/* Active: close to start voting */}
        {challenge.status === "active" && (isParticipant || user.isAdmin) && (
          <div className="card text-center space-y-2">
            <p className="text-sm text-slate-400">
              {isAcceptor
                ? "Finished? Close it and let everyone vote on whether you completed it."
                : `${challenge.acceptedBy?.username} is working on it. Either of you can close when it's done.`}
            </p>
            <button
              onClick={() => action("close")}
              disabled={loading === "close"}
              className="btn-ghost w-full"
            >
              {loading === "close" ? "Closing..." : "Close & Start Voting"}
            </button>
          </div>
        )}

        {/* Voting */}
        {challenge.status === "voting" && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Vote — did <span className="text-emerald-300">{challenge.acceptedBy?.username}</span> complete this?</h3>
            <p className="text-sm text-slate-400">Settles when 2+ weighted votes agree. If completed, they earn {pts(netPayout)} pts.</p>

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
                  <p className="text-xs opacity-70">{thumbUsesLeft} use{thumbUsesLeft !== 1 ? "s" : ""} left · counts double</p>
                </div>
                <span className="ml-auto">{useThumb ? "✓" : "○"}</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => vote("completed")}
                disabled={!!myVote || loading.startsWith("vote")}
                className={`p-3 rounded-xl text-center transition-all ${
                  myVote?.choice === "completed"
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <p className="text-sm font-medium">✓ Completed</p>
                <p className="text-xs text-slate-400 mt-0.5">{completedW} vote{completedW !== 1 ? "s" : ""}</p>
              </button>
              <button
                onClick={() => vote("incomplete")}
                disabled={!!myVote || loading.startsWith("vote")}
                className={`p-3 rounded-xl text-center transition-all ${
                  myVote?.choice === "incomplete"
                    ? "bg-rose-600 text-white ring-2 ring-rose-400"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <p className="text-sm font-medium">✗ Incomplete</p>
                <p className="text-xs text-slate-400 mt-0.5">{incompleteW} vote{incompleteW !== 1 ? "s" : ""}</p>
              </button>
            </div>

            {challenge.votes.length > 0 && (
              <div className="text-xs text-slate-500 space-y-0.5">
                {challenge.votes.map((v) => (
                  <p key={v.id}>
                    {v.user.username} →{" "}
                    <span className={v.choice === "completed" ? "text-emerald-400" : "text-rose-400"}>
                      {v.choice}
                    </span>
                    {v.weight > 1 && <span className="text-amber-400"> ×{v.weight}</span>}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin force-settle */}
        {user.isAdmin && challenge.status === "voting" && (
          <div className="card space-y-3">
            <h3 className="font-semibold text-amber-400">Admin: Force Settle</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => vote("completed")} disabled={loading.startsWith("vote")} className="btn-primary text-sm">
                Mark Completed
              </button>
              <button onClick={() => vote("incomplete")} disabled={loading.startsWith("vote")} className="btn-danger text-sm">
                Mark Incomplete
              </button>
            </div>
          </div>
        )}

        {/* Settled */}
        {challenge.status === "settled" && (
          <div className={`card text-center space-y-2 ${challenge.winnerUserId === challenge.creator.id ? "border-slate-500/30 bg-slate-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
            {challenge.winnerUserId === challenge.creator.id ? (
              <>
                <p className="text-slate-300 font-bold text-lg">Not completed</p>
                <p className="text-sm text-slate-400">{challenge.creator.username} was refunded {pts(challenge.offer)} pts</p>
              </>
            ) : (
              <>
                <p className="text-emerald-400 font-bold text-lg">✓ {winnerName} completed it!</p>
                <p className="text-sm text-slate-400">Earned {pts(netPayout)} pts</p>
                {challenge.multiplier > 1 && (
                  <p className="text-xs text-amber-400">({challenge.multiplier}x multiplier was applied)</p>
                )}
              </>
            )}
            <p className="text-xs text-slate-500">
              Votes: <span className="text-emerald-400">{completedW} completed</span>
              {" · "}
              <span className="text-rose-400">{incompleteW} incomplete</span>
            </p>
            {challenge.settledAt && <p className="text-xs text-slate-600">{formatDate(challenge.settledAt)}</p>}
          </div>
        )}

        {/* Cancelled */}
        {challenge.status === "cancelled" && (
          <div className="card text-center text-slate-500 text-sm py-4">
            Cancelled. {pts(challenge.offer)} pts refunded to {challenge.creator.username}.
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
