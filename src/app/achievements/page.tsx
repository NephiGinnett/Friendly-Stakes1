"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean; avatarAchievementId: string | null };
type AchievementEntry = {
  id: string;
  unlocked: boolean;
  claimed: boolean;
  unlockedAt: string | null;
  name: string;
  description: string | null;
  reward: string | null;
  emoji: string;
  imageUrl: string | null;
  frozenData: string | null;
};

export default function AchievementsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [achievements, setAchievements] = useState<AchievementEntry[]>([]);
  const [loading, setLoading] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [claimResult, setClaimResult] = useState<{
    name: string;
    newPoints: number;
    rewardType: "swap" | "increment" | "item" | "passive";
    rewardPoints?: number;
    rewardLabel?: string;
  } | null>(null);

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch("/api/achievements").then((r) => r.json()).then(setAchievements);
  };

  const setAvatar = async (achievementId: string | null) => {
    setAvatarLoading(true);
    await fetch("/api/achievements/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achievementId }),
    });
    setAvatarLoading(false);
    fetchData();
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
              ) : claimResult.rewardType === "passive" ? (
                <span className="text-white font-bold">Perk is active!</span>
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
              <div className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center ${!a.unlocked ? "grayscale opacity-40" : ""}`}>
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageUrl} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">{a.emoji}</span>
                )}
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
                    {a.id === "fuck_you" && (() => {
                      const d = a.frozenData ? JSON.parse(a.frozenData) as { username: string; victimUsername: string; attemptedAt: string; ip: string; pin: string } : null;
                      return (
                        <div className="mt-2 text-xs text-slate-500 font-mono space-y-1 border-l-2 border-red-500/40 pl-3">
                          <p>{d ? `${d.username} just tried to hack a warded player.` : "Someone just tried to hack a warded player."} From this point forward, a PIN Crack attempt on a warded player will be reflected back between 40 and 75%. Because {d ? `${d.username} was` : "they were"} the first, everyone who gets this achievement after them is going to see this.</p>
                          {d && (
                            <>
                              <p className="text-slate-400">{"_".repeat(8)}</p>
                              <p><span className="text-slate-300">{d.username}</span> attempted to crack <span className="text-rose-300">{d.victimUsername}</span></p>
                              <p className="text-slate-400">{d.attemptedAt}</p>
                              <p className="text-slate-400">{"_".repeat(8)}</p>
                              <p>{d.username}: <span className="text-slate-300">{d.ip}</span></p>
                              <p>{d.username}: <span className="text-red-300 tracking-widest">{d.pin}</span></p>
                              <p className="text-slate-500 italic">Sure would suck to have someone else see that... Huh?</p>
                            </>
                          )}
                        </div>
                      );
                    })()}
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

            {/* Claim button */}
            {a.unlocked && !a.claimed && a.reward && (
              <button
                onClick={() => claim(a.id, a.name)}
                disabled={loading === a.id}
                className="btn-primary w-full"
              >
                {loading === a.id ? "Claiming..." : `Claim reward — ${a.reward}`}
              </button>
            )}

            {/* Set avatar button — only for claimed achievements with an image */}
            {a.claimed && a.imageUrl && (
              <button
                onClick={() => setAvatar(user?.avatarAchievementId === a.id ? null : a.id)}
                disabled={avatarLoading}
                className={`w-full py-2 rounded-xl text-xs font-medium transition-colors border ${
                  user?.avatarAchievementId === a.id
                    ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {user?.avatarAchievementId === a.id ? "✓ Profile avatar — click to remove" : "Set as profile avatar"}
              </button>
            )}
          </div>
        ))}
      </div>

      <Navbar />
    </div>
  );
}
