"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";
import { SHOP_ITEMS, EARLYBIRD_TIERS, EARLYBIRD_TOTAL } from "@/lib/shop";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type OwnedItem = { id: number; itemType: string; usesLeft: number };
type EarlybirdStatus = { purchased: number; remaining: number; nextTier: number | null; userClaimed: number };
type AllUsers = { id: number; username: string }[];

export default function ShopPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [earlybird, setEarlybird] = useState<EarlybirdStatus>({
    purchased: 0,
    remaining: EARLYBIRD_TOTAL,
    nextTier: EARLYBIRD_TIERS[0],
    userClaimed: 0,
  });
  const [allUsers, setAllUsers] = useState<AllUsers>([]);
  const [xrayTarget, setXrayTarget] = useState("");
  const [xrayPeeks, setXrayPeeks] = useState<Record<string, string>>({});
  const [xrayReveal, setXrayReveal] = useState<{ username: string; pin: string } | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinResetMsg, setPinResetMsg] = useState("");
  const [donateTarget, setDonateTarget] = useState("");
  const [donateAmount, setDonateAmount] = useState("");
  const [donateMsg, setDonateMsg] = useState("");
  const [becouUsers, setBecouUsers] = useState<{ id: number; username: string }[]>([]);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [earlybirdResult, setEarlybirdResult] = useState<{ tierValue: number; slot: number } | null>(null);
  const [historyTarget, setHistoryTarget] = useState("");
  const [historyResult, setHistoryResult] = useState<{ username: string; logs: { id: number; amount: number; reason: string; createdAt: string }[] } | null>(null);

  const fetchData = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      setOwned(d.owned ?? []);
      setEarlybird(d.earlybird);
    });
    fetch("/api/users").then((r) => r.ok ? r.json() : []).then(setAllUsers);
    fetch("/api/shop/becou-users").then((r) => r.ok ? r.json() : []).then(setBecouUsers);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("xray_peeks");
      if (saved) setXrayPeeks(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      setOwned(d.owned ?? []);
      setEarlybird(d.earlybird);
    });
    fetch("/api/users").then((r) => r.ok ? r.json() : []).then(setAllUsers);
    fetch("/api/shop/becou-users").then((r) => r.ok ? r.json() : []).then(setBecouUsers);
  }, [router]);

  const buy = async (itemType: string) => {
    setLoading(`buy-${itemType}`);
    setMessage("");
    setEarlybirdResult(null);

    const res = await fetch("/api/shop/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType }),
    });
    const data = await res.json();
    setLoading("");

    if (res.ok) {
      if (itemType === "earlybird" && data.tierValue) {
        setEarlybirdResult({ tierValue: data.tierValue, slot: data.slot });
      } else {
        setMessage("Purchased! Check your inventory below.");
      }
      fetchData();
    } else {
      setMessage(data.error);
    }
  };

  const useXray = async () => {
    if (!xrayTarget) return;
    setLoading("xray");
    setMessage("");
    const res = await fetch("/api/shop/use/xray", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUsername: xrayTarget }),
    });
    const data = await res.json();
    setLoading("");
    if (res.ok) {
      if (data.reflected) {
        setMessage(data.penalty > 0
          ? `🪃 Reflected! ${xrayTarget} was warded. You lost an extra ${data.penalty} pts as a penalty. Check your achievements.`
          : `🪃 Reflected! ${xrayTarget} was warded. Your PIN Crack was consumed. Check your achievements.`);
      } else {
        setXrayReveal({ username: xrayTarget, pin: data.pin });
      }
      fetchData();
    } else {
      setMessage(data.error);
    }
  };

  const confirmXrayReveal = () => {
    if (!xrayReveal) return;
    const updated = { ...xrayPeeks, [xrayReveal.username]: xrayReveal.pin };
    setXrayPeeks(updated);
    try { localStorage.setItem("xray_peeks", JSON.stringify(updated)); } catch { /* ignore */ }
    setXrayReveal(null);
  };

  if (!user) return null;

  const ownedXray = owned.find((i) => i.itemType === "xray");
  const ownedThumb = owned.find((i) => i.itemType === "thumb");
  const ownedPinreset = owned.find((i) => i.itemType === "pinreset");
  const ownedBecou = owned.find((i) => i.itemType === "becou");
  const ownedStsins = owned.find((i) => i.itemType === "stsins");
  const ownedWard = owned.find((i) => i.itemType === "ward");
  const ownedEarlybird = owned.find((i) => i.itemType === "earlybird");
  const ownedVpn = owned.find((i) => i.itemType === "temp_vpn");
  const ownedHistoryViewer = owned.find((i) => i.itemType === "history_viewer");
  const hasEarlybird = !!ownedEarlybird ||
    !!(earlybird.remaining < EARLYBIRD_TOTAL &&
      owned.length === 0 &&
      false); // re-evaluated from owned list

  // Check earlybird in all owned (including usesLeft = 0 for display purposes)
  const claimedEarlybird = ownedEarlybird;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Enhancement Shop</h1>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {message && (
          <div className="text-sm text-center py-2 px-4 rounded-xl bg-white/5 text-slate-300">
            {message}
          </div>
        )}

        {/* Early Adopter result banner */}
        {earlybirdResult && (
          <div className="card border-amber-500/40 bg-amber-500/10 text-center space-y-2">
            <p className="text-amber-300 font-bold text-lg">⭐ Early Adopter — Slot #{earlybirdResult.slot}</p>
            <p className="text-slate-300 text-sm">Your points have been set to</p>
            <p className="text-4xl font-bold text-white">{formatPoints(earlybirdResult.tierValue)}</p>
          </div>
        )}

        {/* ── Early Adopter ── */}
        <div>
          <h2 className="font-semibold text-slate-400 text-sm uppercase tracking-wide mb-3">Limited Offer</h2>

          <div className="card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white text-lg">⭐ Early Adopter</p>
                <p className="text-sm text-slate-400 mt-0.5">
                  Swap your point balance for a tiered reward. Earlier = better. Free!
                </p>
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                earlybird.remaining > 0 ? "bg-amber-500/20 text-amber-300" : "bg-slate-500/20 text-slate-500"
              }`}>
                {earlybird.remaining}/{EARLYBIRD_TOTAL} left
              </span>
            </div>

            {/* Tier ladder */}
            <div className="grid grid-cols-6 gap-1.5">
              {EARLYBIRD_TIERS.map((tier, i) => {
                const claimed = i < earlybird.purchased;
                const isNext = i === earlybird.purchased;
                return (
                  <div
                    key={i}
                    className={`rounded-lg p-2 text-center transition-all ${
                      claimed
                        ? "bg-slate-700/50 text-slate-600"
                        : isNext
                        ? "bg-amber-500/25 border border-amber-500/50 text-amber-300"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    <p className="text-xs font-bold leading-none">{tier >= 1000 ? `${tier/100}` : tier}</p>
                    <p className="text-xs opacity-60 mt-0.5">{claimed ? "✓" : isNext ? "next" : ""}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 -mt-2 text-center">
              Numbers shown are ×100 pts (e.g. 15 = 1,500 pts)
            </p>

            {earlybird.userClaimed > 0 && (
              <div className="bg-amber-500/10 text-amber-300 text-xs px-3 py-1.5 rounded-xl text-center">
                ⭐ You&apos;ve claimed {earlybird.userClaimed} slot{earlybird.userClaimed !== 1 ? "s" : ""} so far
              </div>
            )}
            {earlybird.remaining === 0 ? (
              <div className="bg-slate-500/10 text-slate-500 text-sm px-3 py-2 rounded-xl text-center">
                All slots claimed!
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-300 text-center">
                  Claim now → your balance becomes{" "}
                  <span className="text-amber-300 font-bold">{formatPoints(earlybird.nextTier!)}</span>
                </p>
                <button
                  onClick={() => buy("earlybird")}
                  disabled={loading === "buy-earlybird"}
                  className="btn-primary w-full bg-amber-600 hover:bg-amber-500"
                >
                  {loading === "buy-earlybird" ? "Claiming..." : "Claim Early Adopter Slot"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Standard items ── */}
        <div>
          <h2 className="font-semibold text-slate-400 text-sm uppercase tracking-wide mb-3">Power-Ups</h2>

          {([SHOP_ITEMS.becou, SHOP_ITEMS.ward, SHOP_ITEMS.stsins, SHOP_ITEMS.pinreset, SHOP_ITEMS.thumb, SHOP_ITEMS.temp_vpn, SHOP_ITEMS.history_viewer, SHOP_ITEMS.xray] as typeof SHOP_ITEMS[keyof typeof SHOP_ITEMS][]).map((item) => {
            const alreadyOwned =
              item.id === "xray" ? ownedXray :
              item.id === "ward" ? ownedWard :
              item.id === "thumb" ? ownedThumb :
              item.id === "pinreset" ? ownedPinreset :
              item.id === "becou" ? ownedBecou :
              item.id === "temp_vpn" ? ownedVpn :
              item.id === "history_viewer" ? ownedHistoryViewer :
              ownedStsins;
            return (
              <div key={item.id} className="card space-y-3 mb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white text-lg">{item.emoji} {item.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                  <p className="shrink-0 text-violet-400 font-bold">{formatPoints(item.price)} pts</p>
                </div>

                {alreadyOwned ? (
                  item.id === "becou" ? (
                    <div className="bg-sky-500/10 text-sky-300 text-sm px-3 py-2 rounded-xl text-center font-semibold">
                      🕊️ You have the Be Cou tag
                    </div>
                  ) : item.id === "stsins" ? (
                    <div className="space-y-2">
                      <div className="bg-rose-500/10 text-rose-300 text-sm px-3 py-2 rounded-xl text-center font-semibold">
                        😈 You have the St Sins tag
                      </div>
                      <p className="text-xs text-slate-500 text-center">Scroll down to donate points to a Be Cou player.</p>
                    </div>
                  ) : item.id === "ward" ? (
                    <div className={`text-sm px-3 py-2 rounded-xl text-center font-semibold ${
                      alreadyOwned.usesLeft > 0
                        ? "bg-sky-500/10 text-sky-300"
                        : "bg-slate-500/10 text-slate-500"
                    }`}>
                      {alreadyOwned.usesLeft > 0 ? "🛡️ Ward active — PIN is protected" : "🛡️ Ward was triggered (0 uses left)"}
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 text-emerald-400 text-sm px-3 py-2 rounded-xl">
                      {alreadyOwned.usesLeft} use{alreadyOwned.usesLeft !== 1 ? "s" : ""} left
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => buy(item.id)}
                    disabled={loading === `buy-${item.id}` || user.points < item.price}
                    className="btn-primary w-full"
                  >
                    {loading === `buy-${item.id}`
                      ? "Buying..."
                      : user.points < item.price
                      ? "Not enough points"
                      : `Buy for ${formatPoints(item.price)} pts`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── New Bingo Card ── */}
        <div>
          <h2 className="font-semibold text-slate-400 text-sm uppercase tracking-wide mb-3">Bingo</h2>
          <div className="card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-white text-lg">🎱 New Bingo Card</p>
                <p className="text-sm text-slate-400 mt-0.5">
                  Wipe your current bingo card and get a freshly shuffled one. No refunds, no regrets.
                </p>
              </div>
              <p className="shrink-0 text-violet-400 font-bold">1,500 pts</p>
            </div>
            <button
              onClick={() => buy("newbingocard")}
              disabled={loading === "buy-newbingocard" || user.points < 1500}
              className="btn-primary w-full"
            >
              {loading === "buy-newbingocard"
                ? "Shuffling..."
                : user.points < 1500
                ? "Not enough points"
                : "Get New Card — 1,500 pts"}
            </button>
          </div>
        </div>

        {/* Inventory — active use panels */}
        {(ownedXray || ownedThumb || ownedPinreset || ownedStsins || ownedWard || ownedVpn || ownedHistoryViewer || Object.keys(xrayPeeks).length > 0) && (
          <>
            <h2 className="font-semibold text-slate-400 text-sm uppercase tracking-wide pt-2">Use Your Items</h2>

            {ownedXray && (
              <div className="card space-y-3">
                <p className="font-semibold text-white">💀 PIN Crack</p>

                {/* Saved peeks — always visible */}
                {Object.keys(xrayPeeks).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Peeked PINs</p>
                    {Object.entries(xrayPeeks).map(([username, pin]) => (
                      <div key={username} className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
                        <p className="text-sm text-slate-400">{username}</p>
                        <p className="text-2xl font-bold tracking-[0.25em] text-violet-300">{pin}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Use panel — only when charge remains */}
                {ownedXray.usesLeft > 0 && (
                  <>
                    <p className="text-sm text-slate-400">Pick a player to peek at their PIN. Uses your one charge.</p>
                    <div className="flex gap-2">
                      <select
                        className="input flex-1"
                        value={xrayTarget}
                        onChange={(e) => setXrayTarget(e.target.value)}
                      >
                        <option value="">Select a player...</option>
                        {allUsers
                          .filter((u) => u.username !== user.username)
                          .map((u) => (
                            <option key={u.id} value={u.username}>{u.username}</option>
                          ))}
                      </select>
                      <button
                        onClick={useXray}
                        disabled={!xrayTarget || loading === "xray"}
                        className="btn-primary"
                      >
                        {loading === "xray" ? "..." : "Peek"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {ownedThumb && ownedThumb.usesLeft > 0 && (
              <div className="card space-y-2">
                <p className="font-semibold text-white">👍 Thumb on the Scale — {ownedThumb.usesLeft} use{ownedThumb.usesLeft !== 1 ? "s" : ""} left</p>
                <p className="text-sm text-slate-400">
                  When voting on a wager, toggle &quot;Use Thumb on the Scale&quot; before casting your vote to make it count double.
                </p>
              </div>
            )}

            {ownedPinreset && ownedPinreset.usesLeft > 0 && (
              <div className="card space-y-3">
                <p className="font-semibold text-white">🔑 Use Pin Reset</p>
                <p className="text-sm text-slate-400">Enter your new 2–4 digit PIN.</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    className="input flex-1"
                    placeholder="New PIN (2–4 digits)"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, "")); setPinResetMsg(""); }}
                  />
                  <button
                    onClick={async () => {
                      setLoading("pinreset");
                      setPinResetMsg("");
                      const res = await fetch("/api/shop/use/pinreset", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ newPin }),
                      });
                      const data = await res.json();
                      setLoading("");
                      if (res.ok) {
                        setPinResetMsg("PIN updated!");
                        setNewPin("");
                        fetchData();
                      } else {
                        setPinResetMsg(data.error ?? "Something went wrong.");
                      }
                    }}
                    disabled={newPin.length < 2 || loading === "pinreset"}
                    className="btn-primary"
                  >
                    {loading === "pinreset" ? "..." : "Set"}
                  </button>
                </div>
                {pinResetMsg && (
                  <p className={`text-sm ${pinResetMsg === "PIN updated!" ? "text-emerald-400" : "text-red-400"}`}>
                    {pinResetMsg}
                  </p>
                )}
              </div>
            )}

            {ownedVpn && ownedVpn.usesLeft > 0 && (
              <div className="card space-y-2">
                <p className="font-semibold text-white">🕵️ Temporary VPN — {ownedVpn.usesLeft} use{ownedVpn.usesLeft !== 1 ? "s" : ""} left</p>
                <p className="text-sm text-slate-400">
                  Toggle &quot;Use Temporary VPN&quot; when posting or accepting a wager/challenge to anonymize all participant names and amounts from observers. Activate on the wager or challenge page.
                </p>
              </div>
            )}

            {ownedHistoryViewer && ownedHistoryViewer.usesLeft > 0 && (
              <div className="card space-y-3">
                <p className="font-semibold text-white">📋 Point History Viewer — {ownedHistoryViewer.usesLeft} use{ownedHistoryViewer.usesLeft !== 1 ? "s" : ""} left</p>
                <p className="text-sm text-slate-400">Pick a player to see their full point history. Consumes your one charge.</p>
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={historyTarget}
                    onChange={(e) => setHistoryTarget(e.target.value)}
                  >
                    <option value="">Select a player...</option>
                    {allUsers.filter((u) => u.username !== user.username).map((u) => (
                      <option key={u.id} value={u.username}>{u.username}</option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!historyTarget) return;
                      setLoading("historyview");
                      setMessage("");
                      const res = await fetch("/api/shop/use/historyview", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ targetUsername: historyTarget }),
                      });
                      const data = await res.json();
                      setLoading("");
                      if (res.ok) { setHistoryResult(data); fetchData(); }
                      else setMessage(data.error ?? "Something went wrong.");
                    }}
                    disabled={!historyTarget || loading === "historyview"}
                    className="btn-primary"
                  >
                    {loading === "historyview" ? "..." : "View"}
                  </button>
                </div>
              </div>
            )}

            {ownedStsins && (
              <div className="card space-y-3">
                <p className="font-semibold text-white">😈 St Sins — Donate Points</p>
                <p className="text-sm text-slate-400">
                  Send points to any player with the Be Cou tag. Max: your current balance ({formatPoints(user.points)} pts).
                </p>
                {becouUsers.filter((u) => u.username !== user.username).length === 0 ? (
                  <p className="text-sm text-slate-600 italic">No Be Cou players yet.</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <select
                        className="input flex-1"
                        value={donateTarget}
                        onChange={(e) => { setDonateTarget(e.target.value); setDonateMsg(""); }}
                      >
                        <option value="">Select a Be Cou player...</option>
                        {becouUsers
                          .filter((u) => u.username !== user.username)
                          .map((u) => (
                            <option key={u.id} value={u.username}>{u.username}</option>
                          ))}
                      </select>
                      <input
                        type="number"
                        className="input w-24"
                        placeholder="Pts"
                        min={1}
                        max={user.points}
                        value={donateAmount}
                        onChange={(e) => { setDonateAmount(e.target.value); setDonateMsg(""); }}
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const amt = parseInt(donateAmount);
                        if (!donateTarget || !amt || amt <= 0) return;
                        setLoading("donate");
                        setDonateMsg("");
                        const res = await fetch("/api/shop/use/donate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ targetUsername: donateTarget, amount: amt }),
                        });
                        const data = await res.json();
                        setLoading("");
                        if (res.ok) {
                          setDonateMsg(`Donated ${formatPoints(amt)} pts to ${donateTarget}!`);
                          setDonateAmount("");
                          fetchData();
                        } else {
                          setDonateMsg(data.error ?? "Something went wrong.");
                        }
                      }}
                      disabled={!donateTarget || !donateAmount || parseInt(donateAmount) <= 0 || parseInt(donateAmount) > user.points || loading === "donate"}
                      className="btn-primary w-full"
                    >
                      {loading === "donate" ? "Donating..." : "Donate"}
                    </button>
                    {donateMsg && (
                      <p className={`text-sm ${donateMsg.startsWith("Donated") ? "text-emerald-400" : "text-red-400"}`}>
                        {donateMsg}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* History viewer modal */}
      {historyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-[rgb(22,22,32)] border border-violet-500/30 p-6 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <p className="font-semibold text-white">📋 {historyResult.username}&apos;s Point History</p>
              <button onClick={() => setHistoryResult(null)} className="text-slate-500 hover:text-slate-300 text-sm">✕</button>
            </div>
            <div className="overflow-y-auto space-y-1.5 flex-1">
              {historyResult.logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No history yet.</p>
              ) : historyResult.logs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-2 text-xs py-1.5 border-b border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 truncate">{log.reason}</p>
                    <p className="text-slate-600">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`shrink-0 font-mono font-bold ${log.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {log.amount >= 0 ? "+" : ""}{log.amount}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setHistoryResult(null)} className="btn-primary w-full shrink-0">Close</button>
          </div>
        </div>
      )}

      {/* PIN reveal modal */}
      {xrayReveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-[rgb(22,22,32)] border border-violet-500/30 p-6 space-y-5 text-center shadow-2xl">
            <p className="text-slate-400 text-sm">💀 PIN Crack successful</p>
            <p className="text-white font-semibold text-lg">{xrayReveal.username}&apos;s PIN</p>
            <p className="text-6xl font-bold tracking-[0.3em] text-violet-300 py-2">{xrayReveal.pin}</p>
            <p className="text-xs text-slate-500">Screenshot this — it will be saved below after you dismiss.</p>
            <button
              onClick={confirmXrayReveal}
              className="btn-primary w-full"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}
