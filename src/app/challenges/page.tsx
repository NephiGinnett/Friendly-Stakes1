"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints, formatDate } from "@/lib/utils";

const CHALLENGE_FEE = 50;

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Challenge = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  offer: number;
  multiplier: number;
  creatorId: number;
  targetId: number | null;
  acceptedById: number | null;
  winnerUserId: number | null;
  settledAt: string | null;
  createdAt: string;
  creator: { id: number; username: string };
  target: { id: number; username: string } | null;
  acceptedBy: { id: number; username: string } | null;
  votes: { id: number; choice: string; weight: number }[];
  vpnMasked?: boolean;
};
type AllUser = { id: number; username: string };

const statusColor = (s: string) => {
  if (s === "pending") return "text-amber-300 bg-amber-500/20";
  if (s === "active") return "text-emerald-300 bg-emerald-500/20";
  if (s === "voting") return "text-violet-300 bg-violet-500/20";
  if (s === "settled") return "text-slate-400 bg-slate-500/20";
  return "text-slate-500 bg-slate-500/10";
};

export default function ChallengesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState("");
  const [formError, setFormError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [targetUser, setTargetUser] = useState("open");
  const [offer, setOffer] = useState("");
  const [useVpn, setUseVpn] = useState(false);
  const [hasVpn, setHasVpn] = useState(false);

  const fetchAll = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch("/api/challenges").then((r) => r.json()).then(setChallenges);
    fetch("/api/users").then((r) => r.ok ? r.json() : []).then(setAllUsers);
    fetch("/api/shop").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) setHasVpn((d.owned ?? []).some((i: { itemType: string; usesLeft: number }) => i.itemType === "temp_vpn" && i.usesLeft > 0));
    });
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then((u) => { if (u) setUser(u); });
    fetch("/api/challenges").then((r) => r.json()).then(setChallenges);
    fetch("/api/users").then((r) => r.ok ? r.json() : []).then(setAllUsers);
    fetch("/api/shop").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) setHasVpn((d.owned ?? []).some((i: { itemType: string; usesLeft: number }) => i.itemType === "temp_vpn" && i.usesLeft > 0));
    });
  }, [router]);

  const postChallenge = async () => {
    setFormError("");
    const offerNum = parseInt(offer);
    if (!title.trim()) return setFormError("Title required");
    if (!offerNum || offerNum < CHALLENGE_FEE) return setFormError(`Minimum offer is ${CHALLENGE_FEE} pts`);
    setLoading("post");
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: desc.trim() || undefined,
        targetUsername: targetUser,
        offer: offerNum,
        useVpn: useVpn || undefined,
      }),
    });
    const data = await res.json();
    setLoading("");
    if (res.ok) {
      setTitle(""); setDesc(""); setTargetUser("open"); setOffer(""); setUseVpn(false);
      setShowForm(false);
      fetchAll();
    } else {
      setFormError(data.error ?? "Something went wrong");
    }
  };

  if (!user) return null;

  const targetedAtMe = challenges.filter((c) => c.targetId === user.id && c.status === "pending");
  const openBoard = challenges.filter((c) => !c.targetId && c.status === "pending" && c.creatorId !== user.id);
  const myPosted = challenges.filter((c) => c.creatorId === user.id && c.status === "pending");
  const active = challenges.filter((c) => (c.status === "active" || c.status === "voting"));
  const past = challenges.filter((c) => c.status === "settled" || c.status === "cancelled");

  const netPayout = (c: Challenge) => (c.offer - CHALLENGE_FEE) * c.multiplier;
  const pts = (c: Challenge, n: number) => c.vpnMasked ? "???" : formatPoints(n);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Bounty Board</h1>
            {targetedAtMe.length > 0 && (
              <p className="text-xs text-amber-400">{targetedAtMe.length} challenge{targetedAtMe.length !== 1 ? "s" : ""} waiting on you</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <PointsBadge points={user.points} />
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold px-3 py-1.5 rounded-xl transition-colors"
            >
              {showForm ? "Cancel" : "+ Post"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">

        {/* Post form */}
        {showForm && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Post a Bounty</h2>

            <div>
              <label className="label">What&apos;s the challenge?</label>
              <input className="input w-full" placeholder="e.g. Give a compliment to a stranger" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="label">Description <span className="text-slate-600">(optional)</span></label>
              <textarea className="input w-full resize-none h-16 text-sm" placeholder="Rules, context, proof required..." value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} />
            </div>

            <div>
              <label className="label">Who can accept?</label>
              <select className="input w-full" value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
                <option value="open">🌐 Anyone</option>
                {allUsers.filter((u2) => u2.username !== user.username).map((u2) => (
                  <option key={u2.id} value={u2.username}>{u2.username}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Offer (pts)</label>
              <input
                type="number"
                className="input w-full"
                placeholder={`Min ${CHALLENGE_FEE} pts`}
                min={CHALLENGE_FEE}
                max={user.points}
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
              />
              {offer && parseInt(offer) >= CHALLENGE_FEE && (
                <p className="text-xs text-slate-500 mt-1">
                  You escrow <span className="text-white">{formatPoints(parseInt(offer))}</span>.
                  Winner receives <span className="text-violet-300 font-medium">{formatPoints(parseInt(offer) - CHALLENGE_FEE)}</span> ({CHALLENGE_FEE} pt processing fee).
                </p>
              )}
            </div>

            {hasVpn && (
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

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button onClick={postChallenge} disabled={loading === "post" || !title.trim() || parseInt(offer) < CHALLENGE_FEE || parseInt(offer) > user.points} className="btn-primary w-full">
              {loading === "post" ? "Posting..." : "Post Bounty"}
            </button>
          </div>
        )}

        {/* Targeted at me */}
        {targetedAtMe.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-amber-300">⚔️ Challenges for You</h2>
            {targetedAtMe.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="card block space-y-2 hover:border-amber-500/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-white">{c.title}</p>
                  <span className="shrink-0 text-sm font-bold text-amber-300">{pts(c, netPayout(c))}</span>
                </div>
                <p className="text-xs text-slate-500">From <span className="text-slate-300">{c.creator.username}</span></p>
              </Link>
            ))}
          </section>
        )}

        {/* Open board */}
        {openBoard.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-white">🌐 Open Board</h2>
            {openBoard.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="card block space-y-2 hover:border-violet-500/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-white">{c.title}</p>
                  <span className={`shrink-0 text-sm font-bold ${c.multiplier > 1 ? "text-amber-300" : "text-violet-300"}`}>
                    {pts(c, netPayout(c))}{!c.vpnMasked && c.multiplier > 1 && ` ×${c.multiplier}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Posted by <span className="text-slate-300">{c.creator.username}</span></p>
              </Link>
            ))}
          </section>
        )}

        {/* My posted pending */}
        {myPosted.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-white">📭 Your Posted Bounties</h2>
            {myPosted.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="card block space-y-2 hover:border-white/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-white">{c.title}</p>
                  <span className={`shrink-0 text-sm font-bold ${c.multiplier > 1 ? "text-amber-300" : "text-violet-300"}`}>
                    {pts(c, netPayout(c))}{!c.vpnMasked && c.multiplier > 1 && ` ×${c.multiplier}🔥`}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {c.target ? `For ${c.target.username}` : "Open to anyone"} · waiting for acceptance
                </p>
              </Link>
            ))}
          </section>
        )}

        {/* Active / voting */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-white">🔥 In Progress</h2>
            {active.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="card block space-y-2 hover:border-emerald-500/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-white">{c.title}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
                </div>
                <p className="text-xs text-slate-500">
                  <span className="text-violet-300">{c.creator.username}</span> → <span className="text-emerald-300">{c.acceptedBy?.username ?? "?"}</span>
                  {" · "}{pts(c, netPayout(c))} pts{!c.vpnMasked && c.multiplier > 1 && ` ×${c.multiplier}`}
                </p>
              </Link>
            ))}
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-slate-500">Past</h2>
            {past.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="card block opacity-60 hover:opacity-100 transition-opacity space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-white text-sm">{c.title}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {c.status === "settled"
                    ? c.winnerUserId === c.creator.id
                      ? `Refunded to ${c.creator.username} (not completed)`
                      : `${c.acceptedBy?.username ?? "?"} completed it`
                    : "Cancelled"}
                  {c.settledAt && ` · ${formatDate(c.settledAt)}`}
                </p>
              </Link>
            ))}
          </section>
        )}

        {challenges.length === 0 && !showForm && (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl">📋</p>
            <p className="font-semibold text-white">Board is empty</p>
            <p className="text-sm text-slate-500">Post the first bounty to get things started.</p>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
