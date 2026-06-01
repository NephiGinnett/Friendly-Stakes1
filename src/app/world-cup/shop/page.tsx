"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type ShopData = { monitorCans: number; tradeRate: { cans: number; points: number } };
type AchievementData = { id: string; unlocked: boolean; name: string; emoji: string; imageUrl: string | null };

const WC_ACHIEVEMENT_IDS = [
  "group_stage_prophet",
  "five_match_dynasty",
  "three_leg_machine",
  "clean_sweep",
  "off_script",
];

export default function WorldCupShopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const [batches, setBatches] = useState("1");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadShop = () =>
    fetch("/api/world-cup/shop")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setShop(d));

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then((d) => { if (d) setUser(d); });
    loadShop();
    fetch("/api/achievements")
      .then((r) => r.ok ? r.json() : [])
      .then((all: AchievementData[]) =>
        setAchievements(all.filter((a) => WC_ACHIEVEMENT_IDS.includes(a.id)))
      );
  }, [router]);

  const trade = async () => {
    const b = parseInt(batches) || 1;
    if (b < 1) return;
    setLoading(true); setMsg(null);
    const res = await fetch("/api/world-cup/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trade", amount: b }),
    });
    const d = await res.json();
    setLoading(false);
    if (res.ok) {
      setMsg({ text: `✓ Traded ${b * (shop?.tradeRate.cans ?? 5)} cans for +${d.pointsGained} pts`, ok: true });
      setShop((s) => s ? { ...s, monitorCans: d.monitorCans } : s);
      setUser((u) => u ? { ...u, points: u.points + d.pointsGained } : u);
    } else {
      setMsg({ text: d.error ?? "Something went wrong", ok: false });
    }
  };

  if (!user || !shop) return null;

  const b = Math.max(1, parseInt(batches) || 1);
  const cansNeeded = b * shop.tradeRate.cans;
  const ptsPreview = b * shop.tradeRate.points;
  const canAfford = shop.monitorCans >= cansNeeded;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm">←</Link>
            <div>
              <h1 className="text-lg font-bold text-white">Event Shop</h1>
              <p className="text-xs text-slate-500">World Cup 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-300 font-medium bg-amber-500/15 px-2.5 py-1 rounded-full">
              🥤 {shop.monitorCans} cans
            </span>
            <PointsBadge points={user.points} />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Trade card */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔄</span>
            <div>
              <p className="font-semibold text-white">Trade Cans for Points</p>
              <p className="text-xs text-slate-500">{shop.tradeRate.cans} 🥤 = {shop.tradeRate.points} pts</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="label">Batches</label>
              <input
                type="number"
                min={1}
                max={Math.floor(shop.monitorCans / shop.tradeRate.cans) || 1}
                className="input"
                value={batches}
                onChange={(e) => setBatches(e.target.value)}
              />
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-slate-500 mb-1">You&apos;ll spend</p>
              <p className={`text-lg font-bold font-mono ${canAfford ? "text-amber-300" : "text-rose-400"}`}>
                {cansNeeded} 🥤
              </p>
              <p className="text-xs text-emerald-400">+{ptsPreview} pts</p>
            </div>
          </div>

          {msg && (
            <p className={`text-sm font-mono ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>
          )}

          <button
            onClick={trade}
            disabled={loading || !canAfford || shop.monitorCans === 0}
            className="btn-primary w-full"
          >
            {loading ? "Trading..." : canAfford ? `Trade ${cansNeeded} cans → ${ptsPreview} pts` : "Not enough cans"}
          </button>
        </div>

        {/* How to earn */}
        <div className="card bg-slate-500/5 border-slate-500/20 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">How to earn Monitor Cans</p>
          <ul className="text-xs text-slate-500 space-y-1.5">
            <li>⚽ Your team wins a match → earn 🥤 cans</li>
            <li>🎰 Win a Parlay → bonus cans based on legs completed</li>
            <li>🏆 Your team wins the tournament → +3 bonus cans</li>
            <li>⚽ Penalty Shootout (daily) → up to 3 🥤</li>
            <li>🧤 Keeper&apos;s Reflex (daily) → up to 3 🥤</li>
          </ul>
        </div>

        {/* World Cup Achievement Avatars */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">World Cup Achievements</p>
            <Link href="/achievements" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Claim →</Link>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {WC_ACHIEVEMENT_IDS.map((id) => {
              const a = achievements.find((x) => x.id === id);
              const unlocked = a?.unlocked ?? false;
              return (
                <div key={id} className="flex flex-col items-center gap-1.5 text-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${
                    unlocked ? "border-amber-500/40 bg-amber-500/10" : "border-white/5 bg-white/5"
                  }`}>
                    {unlocked && a?.imageUrl
                      ? <img src={a.imageUrl} alt={a.name} className="w-10 h-10 rounded-lg object-cover" />
                      : unlocked
                      ? <span className="text-xl">{a?.emoji ?? "🏅"}</span>
                      : <span className="text-slate-700 text-lg">🔒</span>
                    }
                  </div>
                  <p className="text-[9px] text-slate-600 leading-tight font-mono w-full truncate">
                    {unlocked ? (a?.name ?? id) : "???"}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600 text-center">
            Unlock achievements to use their image as your profile avatar
          </p>
        </div>

      </div>
      <Navbar />
    </div>
  );
}
