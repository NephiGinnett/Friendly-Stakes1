"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints, formatDate, timeUntil, getStatusBg, impliedOdds } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Vote = { id: number; userId: number; choice: string; user: { id: number; username: string } };
type CounterOffer = {
  id: number; userId: number; proposedStake: number; wantCreatorStake: number;
  message: string | null; status: string; createdAt: string;
  user: { id: number; username: string };
};
type Wager = {
  id: number; title: string; description: string | null; creatorPosition: string;
  creatorStake: number; acceptorStake: number | null; deadline: string;
  status: string; winnerId: number | null; settledBy: string | null; settledAt: string | null;
  creator: { id: number; username: string }; acceptor: { id: number; username: string } | null;
  counterOffers: CounterOffer[]; votes: Vote[];
};

export default function WagerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [wager, setWager] = useState<Wager | null>(null);
  const [acceptStake, setAcceptStake] = useState("");
  const [counterStake, setCounterStake] = useState("");
  const [counterCreatorStake, setCounterCreatorStake] = useState("");
  const [counterMsg, setCounterMsg] = useState("");
  const [showCounter, setShowCounter] = useState(false);
  const [loading, setLoading] = useState("");

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch(`/api/wagers/${params.id}`).then((r) => r.json()).then(setWager);
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch(`/api/wagers/${params.id}`)
      .then((r) => { if (!r.ok) { router.push("/feed"); return null; } return r.json(); })
      .then(setWager);
  }, [params.id, router]);

  if (!user || !wager) return null;

  const isCreator = user.id === wager.creator.id;
  const isAcceptor = user.id === wager.acceptor?.id;
  const isParticipant = isCreator || isAcceptor;
  const userVote = wager.votes.find((v) => v.userId === user.id);
  const creatorVotes = wager.votes.filter((v) => v.choice === "creator").length;
  const acceptorVotes = wager.votes.filter((v) => v.choice === "acceptor").length;

  const handleAccept = async () => {
    const stakeNum = parseInt(acceptStake);
    if (!stakeNum) return;
    setLoading("accept");
    await fetch(`/api/wagers/${wager.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stake: stakeNum }),
    });
    setLoading("");
    fetchData();
  };

  const handleCounter = async () => {
    setLoading("counter");
    await fetch(`/api/wagers/${wager.id}/counter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposedStake: parseInt(counterStake),
        wantCreatorStake: parseInt(counterCreatorStake),
        message: counterMsg || undefined,
      }),
    });
    setLoading("");
    setShowCounter(false);
    fetchData();
  };

  const handleCounterResponse = async (counterOfferId: number, action: string) => {
    setLoading(`counter-${counterOfferId}`);
    await fetch(`/api/wagers/${wager.id}/counter`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterOfferId, action }),
    });
    setLoading("");
    fetchData();
  };

  const handleVote = async (choice: string) => {
    setLoading("vote");
    await fetch(`/api/wagers/${wager.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    setLoading("");
    fetchData();
  };

  const handleCloseEarly = async () => {
    setLoading("close");
    await fetch(`/api/wagers/${wager.id}/close-early`, { method: "POST" });
    setLoading("");
    fetchData();
  };

  const handleAdminSettle = async (winnerId: number) => {
    setLoading("settle");
    await fetch(`/api/wagers/${wager.id}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId }),
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
        {/* Wager header */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-white">{wager.title}</h2>
            <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBg(wager.status)}`}>
              {wager.status}
            </span>
          </div>
          {wager.description && <p className="text-sm text-slate-400 mb-4">{wager.description}</p>}

          {/* Stakes breakdown */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/10">
              <div>
                <p className="text-xs text-slate-400">Creator</p>
                <p className="text-sm font-medium text-violet-300">{wager.creator.username}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Position &amp; Stake</p>
                <p className="text-sm text-white">{wager.creatorPosition}</p>
                <p className="text-sm font-bold text-violet-400">{formatPoints(wager.creatorStake)} pts</p>
              </div>
            </div>

            {wager.acceptor && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10">
                <div>
                  <p className="text-xs text-slate-400">Opponent</p>
                  <p className="text-sm font-medium text-sky-300">{wager.acceptor.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Stake</p>
                  <p className="text-sm font-bold text-sky-400">{formatPoints(wager.acceptorStake!)} pts</p>
                </div>
              </div>
            )}
          </div>

          {wager.acceptor && wager.acceptorStake && (
            <p className="text-xs text-slate-500 mb-3">
              Implied odds: {impliedOdds(wager.creatorStake, wager.acceptorStake)}
              {" | "}Total pool: {formatPoints(wager.creatorStake + wager.acceptorStake)} pts
            </p>
          )}

          <p className="text-xs text-slate-500">
            Deadline: {formatDate(wager.deadline)} ({timeUntil(wager.deadline)})
          </p>
        </div>

        {/* ACTIONS — open wager, not creator */}
        {wager.status === "open" && !isCreator && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Take this wager?</h3>

            <div>
              <label className="label">Your stake (you have {formatPoints(user.points)} pts)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input flex-1"
                  placeholder="Match or set your stake"
                  min={1}
                  max={user.points}
                  value={acceptStake}
                  onChange={(e) => setAcceptStake(e.target.value)}
                />
                <button
                  onClick={handleAccept}
                  disabled={!acceptStake || loading === "accept"}
                  className="btn-success"
                >
                  {loading === "accept" ? "..." : "Accept"}
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500">or</div>

            {!showCounter ? (
              <button onClick={() => setShowCounter(true)} className="btn-ghost w-full">
                Suggest different odds
              </button>
            ) : (
              <div className="space-y-3 p-4 rounded-xl bg-white/5">
                <h4 className="text-sm font-medium text-slate-300">Counter-Offer</h4>
                <div>
                  <label className="label">You would stake</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="Your stake"
                    min={1}
                    value={counterStake}
                    onChange={(e) => setCounterStake(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">You want creator to stake</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="Creator's stake"
                    min={1}
                    value={counterCreatorStake}
                    onChange={(e) => setCounterCreatorStake(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Message (optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Why these odds?"
                    value={counterMsg}
                    onChange={(e) => setCounterMsg(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCounter(false)} className="btn-ghost flex-1">Cancel</button>
                  <button
                    onClick={handleCounter}
                    disabled={!counterStake || !counterCreatorStake || loading === "counter"}
                    className="btn-primary flex-1"
                  >
                    {loading === "counter" ? "..." : "Send Offer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Counter-offers (visible to creator) */}
        {wager.status === "open" && isCreator && wager.counterOffers.filter((c) => c.status === "pending").length > 0 && (
          <div className="card space-y-3">
            <h3 className="font-semibold text-white">Counter-Offers</h3>
            {wager.counterOffers
              .filter((c) => c.status === "pending")
              .map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-sky-300">{c.user.username}</span>
                    <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Offers <span className="text-white font-medium">{formatPoints(c.proposedStake)} pts</span>,
                    wants you to stake <span className="text-white font-medium">{formatPoints(c.wantCreatorStake)} pts</span>
                  </p>
                  {c.message && <p className="text-xs text-slate-400 italic">&quot;{c.message}&quot;</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleCounterResponse(c.id, "accept")}
                      disabled={loading === `counter-${c.id}`}
                      className="btn-success text-xs flex-1"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleCounterResponse(c.id, "reject")}
                      disabled={loading === `counter-${c.id}`}
                      className="btn-danger text-xs flex-1"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Close early button */}
        {wager.status === "accepted" && (isParticipant || user.isAdmin) && (
          <button
            onClick={handleCloseEarly}
            disabled={loading === "close"}
            className="btn-ghost w-full"
          >
            {loading === "close" ? "Closing..." : "Close Early & Start Voting"}
          </button>
        )}

        {/* Voting section */}
        {(wager.status === "voting" || wager.status === "accepted") && wager.acceptor && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Who won?</h3>
            <p className="text-sm text-slate-400">
              Vote for the winner. Settles when a majority agrees (min 2 votes).
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote("creator")}
                disabled={loading === "vote"}
                className={`p-3 rounded-xl text-center transition-all ${
                  userVote?.choice === "creator"
                    ? "bg-violet-600 text-white ring-2 ring-violet-400"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <p className="text-sm font-medium">{wager.creator.username}</p>
                <p className="text-xs text-slate-400 mt-0.5">{creatorVotes} vote{creatorVotes !== 1 ? "s" : ""}</p>
              </button>
              <button
                onClick={() => handleVote("acceptor")}
                disabled={loading === "vote"}
                className={`p-3 rounded-xl text-center transition-all ${
                  userVote?.choice === "acceptor"
                    ? "bg-sky-600 text-white ring-2 ring-sky-400"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <p className="text-sm font-medium">{wager.acceptor.username}</p>
                <p className="text-xs text-slate-400 mt-0.5">{acceptorVotes} vote{acceptorVotes !== 1 ? "s" : ""}</p>
              </button>
            </div>

            {wager.votes.length > 0 && (
              <div className="text-xs text-slate-500 space-y-0.5">
                {wager.votes.map((v) => (
                  <p key={v.id}>
                    {v.user.username} voted for{" "}
                    <span className={v.choice === "creator" ? "text-violet-400" : "text-sky-400"}>
                      {v.choice === "creator" ? wager.creator.username : wager.acceptor!.username}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin settle override */}
        {user.isAdmin && wager.acceptor && wager.status !== "settled" && wager.status !== "cancelled" && wager.status !== "open" && (
          <div className="card space-y-3">
            <h3 className="font-semibold text-amber-400">Admin: Settle Wager</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAdminSettle(wager.creator.id)}
                disabled={loading === "settle"}
                className="btn-primary"
              >
                {wager.creator.username} wins
              </button>
              <button
                onClick={() => handleAdminSettle(wager.acceptor!.id)}
                disabled={loading === "settle"}
                className="btn-success"
              >
                {wager.acceptor!.username} wins
              </button>
            </div>
          </div>
        )}

        {/* Settled result */}
        {wager.status === "settled" && (
          <div className="card text-center space-y-2">
            <p className="text-emerald-400 font-bold text-lg">
              {wager.winnerId === wager.creator.id ? wager.creator.username : wager.acceptor?.username} won!
            </p>
            <p className="text-sm text-slate-400">
              Won {formatPoints(wager.creatorStake + (wager.acceptorStake || 0))} pts
              {" "}(settled by {wager.settledBy})
            </p>
            {wager.settledAt && (
              <p className="text-xs text-slate-500">{formatDate(wager.settledAt)}</p>
            )}
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
