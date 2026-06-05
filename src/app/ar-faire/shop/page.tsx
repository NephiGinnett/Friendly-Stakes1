"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

const EVENT_END = new Date("2026-06-10T00:00:00Z");

type User = { id: number; username: string; points: number; isAdmin: boolean };
type BookmarkEntry = { bookmarkId: number; label: string; imageUrl: string; tier: string; count: number };
type ShopData = { tokens: number; gachaPulls: number; pityCounter: number; avidReaderOwned: boolean; bookmarks: BookmarkEntry[] };
type GachaPull = { bookmarkId: number; label: string; imageUrl: string; tier: string; isNew: boolean };

const TIER_COLOR: Record<string, string> = {
  uncommon: "text-slate-400 border-slate-500",
  rare: "text-blue-300 border-blue-500",
  epic: "text-violet-300 border-violet-500",
  legendary: "text-amber-300 border-amber-500",
};
const BM_W = 40;
const BM_H = 140;

function BookmarkCard({ entry }: { entry: BookmarkEntry }) {
  const color = TIER_COLOR[entry.tier];
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative rounded-lg border-2 overflow-hidden ${color.split(" ")[1]}`}
        style={{ width: BM_W, height: BM_H }}
      >
        {entry.imageUrl ? (
          <img src={entry.imageUrl} alt={entry.label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <span className="text-3xl">📖</span>
          </div>
        )}
        {entry.count > 1 && (
          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
            ×{entry.count}
          </div>
        )}
      </div>
      <p className={`text-xs text-center leading-tight max-w-[40px] ${color.split(" ")[0]}`}>{entry.label}</p>
    </div>
  );
}

function GachaReveal({ pulls, onDone }: { pulls: GachaPull[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const current = pulls[idx];
  const color = TIER_COLOR[current.tier];

  const next = () => {
    if (idx < pulls.length - 1) setIdx((i) => i + 1);
    else onDone();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={next}
    >
      <div className="card text-center space-y-4 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs text-slate-500">{idx + 1} / {pulls.length}</p>
        <p className={`font-bold text-lg ${color.split(" ")[0]}`}>{current.tier.toUpperCase()}</p>

        <div className="flex justify-center">
          <div
            className={`relative rounded-lg border-4 overflow-hidden mx-auto ${color.split(" ")[1]}`}
            style={{ width: 60, height: 210 }}
          >
            {current.imageUrl ? (
              <img src={current.imageUrl} alt={current.label} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                <span className="text-4xl">📖</span>
              </div>
            )}
          </div>
        </div>

        <p className="font-semibold text-white">{current.label}</p>
        {current.isNew && <p className="text-xs text-emerald-400">✨ New bookmark!</p>}
        {current.tier === "legendary" && <p className="text-xs text-amber-400 animate-pulse">🌟 LEGENDARY PULL!</p>}

        <button onClick={next} className="btn-primary w-full">
          {idx < pulls.length - 1 ? "Next →" : "Done"}
        </button>
      </div>
    </div>
  );
}

export default function ArShopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [tradeAmt, setTradeAmt] = useState<1 | 5 | 10>(1);
  const [gachaPulls, setGachaPulls] = useState<GachaPull[] | null>(null);

  const fetchAll = useCallback(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch("/api/ar-faire/shop").then((r) => r.ok ? r.json() : null).then(setShop);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/ar-faire/shop").then((r) => r.ok ? r.json() : null).then(setShop);
  }, [router]);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const purchaseAvid = async () => {
    setLoading("avid");
    const res = await fetch("/api/ar-faire/shop/purchase", { method: "POST" });
    const d = await res.json();
    setLoading("");
    if (res.ok) { showMsg("Avid Reader achievement unlocked! 📚", true); fetchAll(); }
    else showMsg(d.error, false);
  };

  const trade = async () => {
    setLoading("trade");
    const res = await fetch("/api/ar-faire/shop/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: tradeAmt }),
    });
    const d = await res.json();
    setLoading("");
    if (res.ok) { showMsg(`Traded ${tradeAmt} 🔖 for ${formatPoints(d.pointsGained)}!`, true); fetchAll(); }
    else showMsg(d.error, false);
  };

  const gacha = async (count: 1 | 10) => {
    setLoading(`gacha-${count}`);
    const res = await fetch("/api/ar-faire/shop/gacha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const d = await res.json();
    setLoading("");
    if (res.ok) {
      setGachaPulls(d.pulls);
      fetchAll();
    } else {
      showMsg(d.error, false);
    }
  };

  if (!user || !shop) return null;

  const tokens = shop.tokens;
  const eventClosed = new Date() >= EVENT_END;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/ar-faire")} className="text-slate-400 hover:text-white text-sm">&larr; AR Faire</button>
            <h1 className="text-lg font-bold text-white mt-0.5">Event Shop</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-violet-300 font-semibold bg-violet-500/15 px-3 py-1 rounded-full">
              🔖 {tokens} tokens
            </span>
            <PointsBadge points={user.points} />
          </div>
        </div>
      </header>

      {gachaPulls && <GachaReveal pulls={gachaPulls} onDone={() => setGachaPulls(null)} />}

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {msg && (
          <div className={`text-sm px-4 py-2 rounded-xl text-center ${msg.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
            {msg.text}
          </div>
        )}

        {eventClosed && (
          <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl px-4 py-3 text-center space-y-1">
            <p className="text-slate-300 font-semibold text-sm">📖 The AR Faire has ended</p>
            <p className="text-slate-500 text-xs">Purchases are closed — your bookmark collection is preserved below.</p>
          </div>
        )}

        {!eventClosed && (
          <>
            {/* Avid Reader achievement */}
            <div className="card space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📚</span>
                <div>
                  <p className="font-semibold text-white">Avid Reader Achievement</p>
                  <p className="text-xs text-slate-500">Shows permanently in your achievements tab. One-time purchase.</p>
                </div>
              </div>
              {shop.avidReaderOwned ? (
                <div className="text-center text-emerald-400 text-sm py-1">✓ Already owned</div>
              ) : (
                <button
                  onClick={purchaseAvid}
                  disabled={loading === "avid" || tokens < 45}
                  className="btn-primary w-full"
                >
                  {loading === "avid" ? "Purchasing..." : "Purchase — 45 🔖 tokens"}
                </button>
              )}
            </div>

            {/* Token trade */}
            <div className="card space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💱</span>
                <div>
                  <p className="font-semibold text-white">Trade Tokens for Points</p>
                  <p className="text-xs text-slate-500">1 🔖 = 10 pts</p>
                </div>
              </div>
              <div className="flex gap-2">
                {([1, 5, 10] as const).map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTradeAmt(amt)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                      tradeAmt === amt
                        ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    {amt} 🔖<br />
                    <span className="text-xs opacity-70">→ {amt * 10} pts</span>
                  </button>
                ))}
              </div>
              <button
                onClick={trade}
                disabled={loading === "trade" || tokens < tradeAmt}
                className="btn-ghost w-full"
              >
                {loading === "trade" ? "Trading..." : `Trade ${tradeAmt} token${tradeAmt !== 1 ? "s" : ""} → ${tradeAmt * 10} pts`}
              </button>
            </div>

            {/* Gacha */}
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎰</span>
                <div>
                  <p className="font-semibold text-white">Bookmark Gacha</p>
                  <p className="text-xs text-slate-500">5 🔖 per pull · Uncommon 60% · Rare 25% · Epic 10% · Legendary 5%</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Total pulls: {shop.gachaPulls}</span>
                {shop.pityCounter > 0 && (
                  <span className="text-violet-400/70">
                    ✨ Pity: +{shop.pityCounter}% epic odds
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => gacha(1)}
                  disabled={!!loading || tokens < 5}
                  className="btn-ghost"
                >
                  {loading === "gacha-1" ? "..." : "Pull ×1 — 5 🔖"}
                </button>
                <button
                  onClick={() => gacha(10)}
                  disabled={!!loading || tokens < 50}
                  className="btn-primary"
                >
                  {loading === "gacha-10" ? "..." : "Pull ×10 — 50 🔖"}
                </button>
              </div>

              {/* Tier legend */}
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  { tier: "uncommon", label: "Uncommon", chance: "60%" },
                  { tier: "rare", label: "Rare", chance: "25%" },
                  { tier: "epic", label: "Epic", chance: "10%" },
                  { tier: "legendary", label: "Legendary", chance: "5%" },
                ].map((t) => (
                  <div key={t.tier} className={`flex justify-between px-2 py-1 rounded-lg ${TIER_COLOR[t.tier].split(" ")[0]} bg-white/5`}>
                    <span>{t.label}</span><span className="opacity-70">{t.chance}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Bookmark collection */}
        {shop.bookmarks.length > 0 && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Your Bookmarks ({shop.bookmarks.length} unique)</h2>
            <div className="flex flex-wrap gap-3">
              {shop.bookmarks.map((bm) => (
                <BookmarkCard key={bm.bookmarkId} entry={bm} />
              ))}
            </div>
          </div>
        )}

        {shop.bookmarks.length === 0 && (
          <div className="card text-center py-8 text-slate-500 space-y-2">
            <p className="text-3xl">🔖</p>
            <p className="text-sm">No bookmarks yet. Try the gacha!</p>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
