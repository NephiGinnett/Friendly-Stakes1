"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type AchievementEntry = {
  id: string;
  unlocked: boolean;
  claimed: boolean;
  unlockedAt: string | null;
  name: string;
  description: string | null;
  reward: string | null;
  emoji: string;
};

export default function AchievementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [achievements, setAchievements] = useState<AchievementEntry[]>([]);
  const [loading, setLoading] = useState("");
  const [claimResult, setClaimResult] = useState<{
    name: string;
    newPoints: number;
    rewardType: "swap" | "increment" | "item";
    rewardPoints?: number;
    rewardLabel?: string;
  } | null>(null);

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch("/api/achievements").then((r) => r.json()).then(setAchievements);
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/achievements").then((r) => r.json()).then(setAchievements);
  }, [router]);

  const claim = async (achievementId: string, name: string) => {
    setLoading(achievementId);
    setClaimResult(null);
    const res = await fetch("/api/achievements/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achievementId }),
    });
    const data = await res.json();
    setLoading("");
    if (res.ok) {
      setClaimResult({
        name,
        newPoints: data.newPoints,
        rewardType: data.rewardType,
        rewardPoints: data.rewardPoints,
        rewardLabel: data.rewardLabel,
      });
      fetchData();
    }
  };

  if (!user) return null;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Achievements</h1>
            <p className="text-xs text-slate-500">{unlockedCount}/{achievements.length} unlocked</p>
          </div>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Claim result banner */}
        {claimResult && (
          <div className="card border-amber-500/40 bg-amber-500/10 text-center space-y-1 animate-pulse">
            <p className="text-amber-300 font-bold text-lg">{claimResult.name} claimed!</p>
            <p className="text-slate-300 text-sm">
              {claimResult.rewardType === "swap" ? (
                <>
                  Balance swapped to{" "}
                  <span className="text-white font-bold">{formatPoints(claimResult.newPoints)} pts</span>
                </>
              ) : claimResult.rewardType === "item" ? (
                <>
                  <span className="text-white font-bold">{claimResult.rewardLabel}</span>
                  {" "}added to your inventory!
                </>
              ) : (
                <>
                  <span className="text-white font-bold">+{formatPoints(claimResult.rewardPoints!)} pts</span>
                  {" "}earned! New balance:{" "}
                  <span className="text-white font-bold">{formatPoints(claimResult.newPoints)} pts</span>
                </>
              )}
            </p>
          </div>
        )}

        {achievements.length === 0 && (
          <p className="text-slate-500 text-center py-12">Loading achievements...</p>
        )}

        {achievements.map((a) => (
          <div
            key={a.id}
            className={`card space-y-3 transition-all ${
              !a.unlocked ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`text-4xl shrink-0 ${!a.unlocked ? "grayscale" : ""}`}>
                {a.emoji}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-bold ${a.unlocked ? "text-white" : "text-slate-600"}`}>
                    {a.name}
                  </h3>
                  {a.unlocked && !a.claimed && (
                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                      New!
                    </span>
                  )}
                  {a.claimed && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                      Claimed
                    </span>
                  )}
                </div>

                {a.unlocked ? (
                  <>
                    <p className="text-sm text-slate-400">{a.description}</p>
                    {a.reward && (
                      <p className="text-xs text-violet-400 mt-1">Reward: {a.reward}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-600 italic">
                    Keep playing to discover this achievement...
                  </p>
                )}
              </div>
            </div>

            {/* Claim button — only for unlocked, unclaimed achievements */}
            {a.unlocked && !a.claimed && a.reward && (
              <button
                onClick={() => claim(a.id, a.name)}
                disabled={loading === a.id}
                className="btn-primary w-full"
              >
                {loading === a.id ? "Claiming..." : `Claim reward — ${a.reward}`}
              </button>
            )}
          </div>
        ))}
      </div>

      <Navbar />
    </div>
  );
}
