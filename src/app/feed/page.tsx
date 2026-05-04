"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import WagerCard from "@/components/WagerCard";
import PointsBadge from "@/components/PointsBadge";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Wager = {
  id: number;
  title: string;
  creatorPosition: string;
  creatorStake: number;
  acceptorStake: number | null;
  deadline: string;
  status: string;
  creator: { id: number; username: string };
  acceptor: { id: number; username: string } | null;
  _count?: { counterOffers: number };
};

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) { router.push("/login"); return null; }
        return r.json();
      })
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    const url = filter === "all" ? "/api/wagers" : `/api/wagers?status=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then(setWagers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  if (!user) return null;

  const filters = ["all", "open", "accepted", "voting", "settled"];

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Friendly Stakes</h1>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4">
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
