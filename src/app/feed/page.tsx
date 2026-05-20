"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import WagerCard from "@/components/WagerCard";
import PointsBadge from "@/components/PointsBadge";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Distribution = { id: number; message: string; rewardType: string; rewardAmount: number; rewardItem: string; rewardItemUses: number };
type WagerEntry = {
  id: number;
  side: string;
  stake: number;
  user: { id: number; username: string };
};
type Wager = {
  id: number;
  title: string;
  creatorPosition: string;
  creatorStake: number;
  deadline: string;
  status: string;
  creator: { id: number; username: string };
  entries: WagerEntry[];
};

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [claiming, setClaiming] = useState<number | null>(null);

  const fetchDistributions = () => {
    fetch("/api/distribution/pending")
      .then((r) => r.ok ? r.json() : [])
      .then(setDistributions)
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) { router.push("/login"); return null; }
        return r.json();
      })
      .then((u) => { setUser(u); })
      .catch(() => router.push("/login"));
    fetchDistributions();
  }, [router]);

  useEffect(() => {
    const url = filter === "all" ? "/api/wagers" : `/api/wagers?status=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then(setWagers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const claimDistribution = async (id: number) => {
    setClaiming(id);
    const res = await fetch(`/api/distribution/${id}/claim`, { method: "POST" });
    setClaiming(null);
    if (res.ok) {
      setDistributions((prev) => prev.filter((d) => d.id !== id));
      fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    }
  };

  if (!user) return null;

  const filters = ["all", "open", "started", "voting", "settled"];

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Friendly Stakes</h1>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Admin distributions */}
        {distributions.length > 0 && (
          <div className="space-y-2 mb-4">
            {distributions.map((d) => (
              <div key={d.id} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide mb-0.5">🎁 Gift from the admin</p>
                  <p className="text-sm text-white leading-snug">{d.message}</p>
                  <p className="text-xs text-amber-300/70 mt-1">
                    {d.rewardType === "points"
                      ? `+${d.rewardAmount.toLocaleString()} pts`
                      : `${d.rewardItem} item (${d.rewardItemUses} use${d.rewardItemUses !== 1 ? "s" : ""})`}
                  </p>
                </div>
                <button
                  onClick={() => claimDistribution(d.id)}
                  disabled={claiming === d.id}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
                >
                  {claiming === d.id ? "..." : "Claim"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-violet-600 text-white"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Wager list */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading wagers...</div>
        ) : wagers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-3">No wagers yet</p>
            <button onClick={() => router.push("/wagers/new")} className="btn-primary">
              Create the first one
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {wagers.map((wager) => (
              <WagerCard key={wager.id} wager={wager} />
            ))}
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
