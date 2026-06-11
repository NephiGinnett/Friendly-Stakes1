"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { formatPoints } from "@/lib/utils";
import { posLabel } from "@/lib/bingo";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type AdminUser = { id: number; username: string; points: number; isAdmin: boolean; pinPlain: string };
type BingoClaim = { id: number; username: string; position: number; text: string; providerName: string; claimNote: string | null };
type BingoItemRecord = { id: number; text: string; providerName: string };
type HouseStatus = { phase: number; bossActive: boolean; bossHp: number; bossMaxHp: number };
type TallyData = {
  totalIn: number; totalOut: number; circulatingTotal: number;
  byCategory: { cat: string; in: number; out: number; net: number }[];
  standings: { id: number; username: string; points: number }[];
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adjustAmounts, setAdjustAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<number | null>(null);

  // Bingo state
  const [claims, setClaims] = useState<BingoClaim[]>([]);
  const [bingoItems, setBingoItems] = useState<BingoItemRecord[]>([]);
  const [itemsRaw, setItemsRaw] = useState("");
  const [addingItems, setAddingItems] = useState(false);
  const [addItemsMsg, setAddItemsMsg] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // Bingo items reset state
  const [confirmResetItems, setConfirmResetItems] = useState(false);
  const [resettingItems, setResettingItems] = useState(false);

  // Casino state
  const [casinoOpen, setCasinoOpen] = useState(true);
  const [casinoMsg, setCasinoMsg] = useState<string | null>(null);
  const [casinoLoading, setCasinoLoading] = useState(false);

  // Bots state
  const [botsEnabled, setBotsEnabled] = useState(true);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsMsg, setBotsMsg] = useState<string | null>(null);

  // Password leak state
  const [leakEnabled, setLeakEnabled] = useState(true);
  const [leakLoading, setLeakLoading] = useState(false);
  const [leakMsg, setLeakMsg] = useState<string | null>(null);
  type BotStat = { id: number; name: string; wins: number; losses: number; lossStreak: number; pointsWon: number; pointsLost: number };
  const [botStats, setBotStats] = useState<BotStat[]>([]);

  // Boss HP controls
  const [bossHpMultiplier, setBossHpMultiplier] = useState(3000);
  const [multiplierInput, setMultiplierInput] = useState("3000");
  const [hpDeltaInput, setHpDeltaInput] = useState("");
  const [bossControlMsg, setBossControlMsg] = useState<string | null>(null);

  // The House state
  const [houseStatus, setHouseStatus] = useState<HouseStatus | null>(null);
  const [housePhaseInput, setHousePhaseInput] = useState("");
  const [houseMsg, setHouseMsg] = useState("");
  const [striking, setStriking] = useState(false);
  const [strikeResult, setStrikeResult] = useState<string | null>(null);
  const [tally, setTally] = useState<TallyData | null>(null);
  const [showTally, setShowTally] = useState(false);

  // Sacrifice state
  const [sacrificeVotes, setSacrificeVotes] = useState<{ username: string; votes: number }[]>([]);
  const [sacrificeOpen, setSacrificeOpen] = useState(false);
  const [sacrificeMsg, setSacrificeMsg] = useState<string | null>(null);
  const [sacrificing, setSacrificing] = useState(false);

  // World Cup bracket state
  type BracketRoundInfo = { slotCount: number; expected: number; pickCount: number; slots: { round: string; position: number; team1Code: string; team2Code: string; winnerCode: string }[] };
  type BracketStatus = { locked: boolean; bracketLockedAt: string | null; worldCupPlayerAt: string | null; entryCount: number; pickerCount: number; byRound: Record<string, BracketRoundInfo>; teams: { id: number; code: string; name: string; flag: string; eliminated: boolean }[]; adminHasEntry: boolean; eliminatedCount: number };
  const [bracketStatus, setBracketStatus] = useState<BracketStatus | null>(null);
  const [bracketMsg, setBracketMsg] = useState<string | null>(null);
  const [bracketExpandRound, setBracketExpandRound] = useState<string | null>(null);
  const [seedForm, setSeedForm] = useState({ round: "R32", position: "0", team1Code: "", team2Code: "" });
  const [seeding, setSeeding] = useState(false);
  const [elimTeamCode, setElimTeamCode] = useState("");

  const loadBracketStatus = () =>
    fetch("/api/admin/world-cup").then((r) => r.ok ? r.json() : null).then(setBracketStatus);

  // AR Faire state
  type ArQuestion = { id: number; order: number; text: string; choiceA: string; choiceB: string; choiceC: string; correctIndex: number };
  type ArPendingQuiz = { id: number; title: string; author: string; tier: string; imageUrl: string | null; sponsor: { id: number; username: string } | null; questions: ArQuestion[] };
  const [arPending, setArPending] = useState<ArPendingQuiz[]>([]);
  const [arMsg, setArMsg] = useState<string | null>(null);
  const [arExpandedQuiz, setArExpandedQuiz] = useState<number | null>(null);
  const [arBookmarks, setArBookmarks] = useState<{ id: number; label: string; tier: string; imageUrl: string }[]>([]);
  const [newBmLabel, setNewBmLabel] = useState("");
  const [newBmTier, setNewBmTier] = useState("uncommon");
  const [newBmUrl, setNewBmUrl] = useState("");
  const [bmMsg, setBmMsg] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  // Wager management state
  type AdminWager = { id: number; title: string; status: string; creatorStake: number; deadline: string; entryCount: number; totalPool: number };
  const [wagers, setWagers] = useState<AdminWager[]>([]);
  const [wagerMsg, setWagerMsg] = useState<string | null>(null);
  const [cancellingWager, setCancellingWager] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  // Distribution state
  type DistributionRecord = { id: number; message: string; rewardType: string; rewardAmount: number; rewardItem: string; rewardItemUses: number; claimCount: number; createdAt: string };
  const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
  const [distMsg, setDistMsg] = useState<string | null>(null);
  const [distSending, setDistSending] = useState(false);
  const [distRewardType, setDistRewardType] = useState<"points" | "item">("points");
  const [distAmount, setDistAmount] = useState("");
  const [distItem, setDistItem] = useState("thumb");
  const [distItemUses, setDistItemUses] = useState("1");
  const [distMessage, setDistMessage] = useState("");

  // Restart state
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartResult, setRestartResult] = useState<{ filename: string; snapshot: string[] } | null>(null);
  const [restartError, setRestartError] = useState<string | null>(null);

  const fetchAll = () => {
    fetch("/api/admin/users").then((r) => r.ok ? r.json() : []).then(setUsers);
    fetch("/api/admin/bingo/claims").then((r) => r.ok ? r.json() : []).then(setClaims);
    fetch("/api/admin/bingo/items").then((r) => r.ok ? r.json() : []).then(setBingoItems);
    fetch("/api/admin/bots/stats").then((r) => r.ok ? r.json() : []).then(setBotStats);
    fetch("/api/house").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) {
        setHouseStatus({ phase: d.phase, bossActive: d.bossActive, bossHp: d.bossHp, bossMaxHp: d.bossMaxHp });
        setCasinoOpen(d.casinoOpen ?? true);
        setBotsEnabled(d.botsEnabled ?? true);
        setLeakEnabled(d.passwordLeakEnabled ?? true);
        const mult = d.bossHpMultiplier ?? 3000;
        setBossHpMultiplier(mult);
        setMultiplierInput(String(mult));
      }
    });
    fetch("/api/house/sacrifice").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) { setSacrificeOpen(d.open); setSacrificeVotes(d.votes ?? []); }
    });
    fetch("/api/admin/ar-faire/pending").then((r) => r.ok ? r.json() : []).then(setArPending);
    fetch("/api/admin/ar-faire/bookmarks").then((r) => r.ok ? r.json() : []).then(setArBookmarks);
    fetch("/api/admin/wagers").then((r) => r.ok ? r.json() : []).then(setWagers);
    fetch("/api/admin/distribution").then((r) => r.ok ? r.json() : []).then(setDistributions);
  };

  const sacrificeAction = async (action: "open" | "close" | "execute") => {
    setSacrificing(true); setSacrificeMsg(null);
    const res = await fetch("/api/admin/house/sacrifice", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    setSacrificing(false);
    if (res.ok) {
      if (action === "execute") {
        setSacrificeMsg(`🩸 ${d.username} sacrificed (${d.sacrificedPoints} pts). ${d.playerCount} survivors each receive ${d.sharePerPlayer} pts. House HP healed ${Math.floor(d.houseHeal / 2)} pts.${d.achievementAwarded ? ` Achievement: ${d.achievementAwarded}` : ""}`);
      } else {
        setSacrificeMsg(action === "open" ? "Vote opened." : "Vote closed.");
      }
      fetchAll();
    } else {
      setSacrificeMsg(d.error);
    }
  };

  const setBossMultiplier = async () => {
    const val = parseInt(multiplierInput);
    if (!val || val < 100) { setBossControlMsg("Must be at least 100."); return; }
    setBossControlMsg(null);
    const res = await fetch("/api/admin/house/boss", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setMultiplier", multiplier: val }),
    });
    const d = await res.json();
    if (res.ok) { setBossHpMultiplier(d.bossHpMultiplier); setBossControlMsg(`Multiplier set to ${d.bossHpMultiplier.toLocaleString()}.`); }
    else setBossControlMsg(d.error);
  };

  const adjustBossHp = async (delta: number) => {
    setBossControlMsg(null);
    const res = await fetch("/api/admin/house/boss", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "adjustHp", delta }),
    });
    const d = await res.json();
    if (res.ok) { setBossControlMsg(`HP adjusted → ${d.bossHp} / ${d.bossMaxHp}`); fetchAll(); }
    else setBossControlMsg(d.error);
  };

  const toggleCasino = async (open: boolean) => {
    setCasinoLoading(true); setCasinoMsg(null);
    const res = await fetch("/api/admin/house/casino", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ open }),
    });
    const d = await res.json();
    setCasinoLoading(false);
    if (res.ok) { setCasinoOpen(d.casinoOpen); setCasinoMsg(d.casinoOpen ? "Casino opened." : "Casino closed."); }
    else setCasinoMsg(d.error);
  };

  const setPhase = async (phase: number) => {
    setHouseMsg("");
    const res = await fetch("/api/admin/house/phase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phase }) });
    const d = await res.json();
    if (res.ok) { setHouseMsg(`Phase set to ${d.phase}`); fetchAll(); }
    else setHouseMsg(d.error);
  };

  const launchBoss = async () => {
    setHouseMsg("");
    const res = await fetch("/api/admin/house/boss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "launch" }) });
    const d = await res.json();
    if (res.ok) { setHouseMsg(`Boss launched! HP: ${d.bossMaxHp}${d.bonusHpApplied ? ` (includes ${d.bonusHpApplied} sacrifice bonus)` : ""}`); fetchAll(); }
    else setHouseMsg(d.error);
  };

  const houseStrike = async () => {
    setStriking(true); setStrikeResult(null);
    const res = await fetch("/api/admin/house/strike", { method: "POST" });
    const d = await res.json();
    setStriking(false);
    if (res.ok) setStrikeResult(d.flavorText);
    else setStrikeResult(d.error);
  };

  const loadTally = async () => {
    const res = await fetch("/api/admin/house/tally");
    if (res.ok) { setTally(await res.json()); setShowTally(true); }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) { router.push("/login"); return null; }
        return r.json();
      })
      .then((u) => {
        if (u && !u.isAdmin) { router.push("/feed"); return; }
        setUser(u);
      });
    fetchAll();
    loadBracketStatus();
  }, [router]);

  const adjustPoints = async (targetId: number) => {
    const amount = parseInt(adjustAmounts[targetId] || "0");
    if (!amount) return;
    setLoading(targetId);
    const res = await fetch(`/api/admin/users/${targetId}/points`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => u.id === targetId ? { ...u, points: updated.points } : u));
      setAdjustAmounts((prev) => ({ ...prev, [targetId]: "" }));
    }
    setLoading(null);
  };

  const approveClaim = async (claimId: number, approved: boolean) => {
    setApprovingId(claimId);
    await fetch("/api/admin/bingo/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ squareId: claimId, approved }),
    });
    setApprovingId(null);
    fetchAll();
  };

  const addBingoItems = async () => {
    if (!itemsRaw.trim()) return;
    setAddingItems(true);
    setAddItemsMsg("");
    const res = await fetch("/api/admin/bingo/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: itemsRaw }),
    });
    const data = await res.json();
    setAddingItems(false);
    if (res.ok) {
      setAddItemsMsg(`Added ${data.added} item${data.added !== 1 ? "s" : ""}!`);
      setItemsRaw("");
      fetchAll();
    } else {
      setAddItemsMsg(data.error ?? "Something went wrong.");
    }
  };

  const resetBingoItems = async () => {
    setResettingItems(true);
    await fetch("/api/admin/bingo/items", { method: "DELETE" });
    setResettingItems(false);
    setConfirmResetItems(false);
    fetchAll();
  };

  const reviewQuiz = async (id: number, action: "approve" | "reject") => {
    setArMsg(null);
    const res = await fetch(`/api/admin/ar-faire/${id}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (res.ok) { setArMsg(`Quiz ${action === "approve" ? "approved ✓" : "rejected — points refunded"}`); fetchAll(); }
    else setArMsg(d.error);
  };

  const addBookmark = async () => {
    if (!newBmLabel.trim()) return;
    setBmMsg(null);
    const res = await fetch("/api/admin/ar-faire/bookmarks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", label: newBmLabel.trim(), tier: newBmTier, imageUrl: newBmUrl.trim() || "" }),
    });
    const d = await res.json();
    if (res.ok) { setBmMsg("Bookmark added!"); setNewBmLabel(""); setNewBmUrl(""); fetchAll(); }
    else setBmMsg(d.error);
  };

  const scanBookmarks = async () => {
    setScanMsg(null);
    const res = await fetch("/api/admin/ar-faire/bookmarks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan" }),
    });
    const d = await res.json();
    setScanMsg(res.ok ? `Scanned: ${d.added} added${d.results?.length ? ` (${d.results.join(", ")})` : ""}` : d.error);
    if (res.ok) fetchAll();
  };

  const sendDistribution = async () => {
    if (!distMessage.trim()) return;
    setDistSending(true); setDistMsg(null);
    const body = distRewardType === "points"
      ? { message: distMessage.trim(), rewardType: "points", rewardAmount: parseInt(distAmount) || 0 }
      : { message: distMessage.trim(), rewardType: "item", rewardItem: distItem, rewardItemUses: parseInt(distItemUses) || 1 };
    const res = await fetch("/api/admin/distribution", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setDistSending(false);
    if (res.ok) { setDistMsg("Distribution sent! Players will see it on their feed."); setDistMessage(""); setDistAmount(""); fetchAll(); }
    else setDistMsg(d.error);
  };

  const cancelWager = async (id: number) => {
    setCancellingWager(id);
    setWagerMsg(null);
    const res = await fetch(`/api/wagers/${id}/cancel`, { method: "POST" });
    const d = await res.json();
    setCancellingWager(null);
    setConfirmCancelId(null);
    if (res.ok) { setWagerMsg(`Wager cancelled — ${d.refundCount} player${d.refundCount !== 1 ? "s" : ""} refunded.`); fetchAll(); }
    else setWagerMsg(d.error);
  };

  const restartGame = async () => {
    setRestarting(true);
    setRestartResult(null);
    setRestartError(null);
    const res = await fetch("/api/admin/restart", { method: "POST" });
    const data = await res.json();
    setRestarting(false);
    setConfirmRestart(false);
    if (res.ok) {
      setRestartResult({ filename: data.filename, snapshot: data.snapshot });
      fetchAll();
    } else {
      setRestartError(data.error ?? "Something went wrong.");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-amber-400">Admin Panel</h1>
          {claims.length > 0 && (
            <span className="bg-amber-500/20 text-amber-300 text-xs font-semibold px-2 py-1 rounded-full">
              {claims.length} bingo claim{claims.length !== 1 ? "s" : ""} pending
            </span>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-8">

        {/* ── Wager Management ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            🎲 Active Wagers
            {wagers.filter((w) => w.status !== "settled" && w.status !== "cancelled").length > 0 && (
              <span className="bg-violet-500/20 text-violet-300 text-xs px-2 py-0.5 rounded-full">
                {wagers.filter((w) => w.status !== "settled" && w.status !== "cancelled").length} open
              </span>
            )}
          </h2>

          {wagerMsg && (
            <p className={`text-sm px-3 py-2 rounded-xl ${wagerMsg.includes("error") || wagerMsg.includes("Error") ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
              {wagerMsg}
            </p>
          )}

          {wagers.length === 0 ? (
            <p className="text-slate-600 text-sm">No wagers found.</p>
          ) : (
            <div className="space-y-2">
              {wagers.map((w) => (
                <div key={w.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{w.title}</p>
                      <p className="text-xs text-slate-500">
                        {w.status} · {w.entryCount} player{w.entryCount !== 1 ? "s" : ""} · {formatPoints(w.totalPool)} pool · deadline {new Date(w.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                      w.status === "settled" ? "bg-emerald-500/15 text-emerald-400" :
                      w.status === "cancelled" ? "bg-slate-500/20 text-slate-500" :
                      new Date(w.deadline) < new Date() ? "bg-rose-500/15 text-rose-400" :
                      "bg-violet-500/15 text-violet-400"
                    }`}>
                      {new Date(w.deadline) < new Date() && w.status !== "settled" && w.status !== "cancelled" ? "overdue" : w.status}
                    </span>
                  </div>

                  {w.status !== "settled" && w.status !== "cancelled" && (
                    confirmCancelId === w.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelWager(w.id)}
                          disabled={cancellingWager === w.id}
                          className="flex-1 py-1.5 rounded-xl text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                        >
                          {cancellingWager === w.id ? "Cancelling..." : "Confirm — refund all stakes"}
                        </button>
                        <button
                          onClick={() => setConfirmCancelId(null)}
                          className="flex-1 py-1.5 rounded-xl text-xs font-medium bg-white/5 text-slate-400 hover:text-white"
                        >
                          Keep it
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancelId(w.id)}
                        className="w-full py-1.5 rounded-xl text-xs font-medium bg-white/5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      >
                        Cancel &amp; refund
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Pending Bingo Claims ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            🎱 Bingo Claims
            {claims.length > 0 && (
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                {claims.length} pending
              </span>
            )}
          </h2>

          {claims.length === 0 ? (
            <p className="text-slate-600 text-sm">No pending claims.</p>
          ) : (
            claims.map((c) => (
              <div key={c.id} className="card space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{c.username}</p>
                    <span className="text-xs text-slate-500">{posLabel(c.position)}</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">{c.text}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Suggested by {c.providerName}</p>
                  {c.claimNote && (
                    <p className="text-sm text-slate-400 mt-2 italic border-l-2 border-violet-500/40 pl-2">
                      &ldquo;{c.claimNote}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveClaim(c.id, true)}
                    disabled={approvingId === c.id}
                    className="btn-primary flex-1 text-sm bg-emerald-600 hover:bg-emerald-500"
                  >
                    {approvingId === c.id ? "..." : "✓ Approve"}
                  </button>
                  <button
                    onClick={() => approveClaim(c.id, false)}
                    disabled={approvingId === c.id}
                    className="flex-1 text-sm px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  >
                    ✕ Deny
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* ── Add Bingo Items ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">📋 Bingo Items Pool</h2>
            <span className="text-xs text-slate-500">{bingoItems.length} items</span>
          </div>

          <div className="card space-y-3">
            <p className="text-xs text-slate-400">
              Paste items one per line in the format:{" "}
              <span className="text-slate-300 font-mono">Bingo item text: PlayerName</span>
            </p>
            <textarea
              className="input w-full h-36 text-sm font-mono resize-none"
              placeholder={"Nephi says something weird: zoe\nSomeone brings snacks: nephi\n..."}
              value={itemsRaw}
              onChange={(e) => setItemsRaw(e.target.value)}
            />
            {addItemsMsg && (
              <p className={`text-sm ${addItemsMsg.startsWith("Added") ? "text-emerald-400" : "text-red-400"}`}>
                {addItemsMsg}
              </p>
            )}
            <button
              onClick={addBingoItems}
              disabled={addingItems || !itemsRaw.trim()}
              className="btn-primary w-full text-sm"
            >
              {addingItems ? "Adding..." : "Add Items to Pool"}
            </button>
          </div>

          {bingoItems.length > 0 && (
            <>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {bingoItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-white/5">
                    <span className="flex-1 text-slate-300">{item.text}</span>
                    <span className="shrink-0 text-slate-500">{item.providerName}</span>
                  </div>
                ))}
              </div>

              {!confirmResetItems ? (
                <button
                  onClick={() => setConfirmResetItems(true)}
                  className="w-full px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors text-sm font-medium"
                >
                  Clear All Bingo Items
                </button>
              ) : (
                <div className="rounded-xl bg-red-500/5 border border-red-500/30 p-3 space-y-3">
                  <p className="text-sm font-semibold text-red-400">Delete all {bingoItems.length} items? This also resets everyone&apos;s bingo cards.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={resetBingoItems}
                      disabled={resettingItems}
                      className="flex-1 px-4 py-2 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors text-sm font-semibold"
                    >
                      {resettingItems ? "Clearing..." : "Yes, clear all"}
                    </button>
                    <button
                      onClick={() => setConfirmResetItems(false)}
                      className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── AR Faire ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">
            📖 AR Faire
            {arPending.length > 0 && (
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">
                {arPending.length} pending
              </span>
            )}
          </h2>

          {arMsg && <p className={`text-sm font-mono ${arMsg.includes("✓") ? "text-emerald-400" : arMsg.includes("refunded") ? "text-amber-400" : "text-red-400"}`}>{arMsg}</p>}

          {/* Pending quiz reviews */}
          {arPending.length === 0 ? (
            <p className="text-slate-600 text-sm">No pending quiz submissions.</p>
          ) : (
            arPending.map((quiz) => (
              <div key={quiz.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{quiz.title}</p>
                    <p className="text-xs text-slate-500">by {quiz.author} · {quiz.tier} tier</p>
                    {quiz.sponsor && <p className="text-xs text-slate-500">Submitted by {quiz.sponsor.username}</p>}
                  </div>
                  <button
                    onClick={() => setArExpandedQuiz(arExpandedQuiz === quiz.id ? null : quiz.id)}
                    className="text-xs text-violet-400 hover:text-violet-300 shrink-0"
                  >
                    {arExpandedQuiz === quiz.id ? "Hide Q&A" : `View ${quiz.questions.length} Q&A`}
                  </button>
                </div>

                {arExpandedQuiz === quiz.id && (
                  <div className="space-y-3 border-t border-white/5 pt-3">
                    {quiz.imageUrl && (
                      <div className="flex gap-3 items-start">
                        <div className="relative rounded-lg overflow-hidden border-2 border-slate-500" style={{ width: 80, height: 280, flexShrink: 0 }}>
                          <img src={quiz.imageUrl} alt="bookmark" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-xs text-slate-500">Bookmark preview</p>
                      </div>
                    )}
                    {quiz.questions.map((q, i) => (
                      <div key={q.id} className="space-y-1">
                        <p className="text-xs font-semibold text-slate-300">Q{i + 1}. {q.text}</p>
                        {[q.choiceA, q.choiceB, q.choiceC].map((c, ci) => (
                          <p key={ci} className={`text-xs pl-3 ${ci === q.correctIndex ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                            {["A", "B", "C"][ci]}. {c} {ci === q.correctIndex && "✓"}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => reviewQuiz(quiz.id, "approve")}
                    className="btn-primary flex-1 text-sm bg-emerald-600 hover:bg-emerald-500"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => reviewQuiz(quiz.id, "reject")}
                    className="flex-1 text-sm px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  >
                    ✕ Reject & Refund
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Bookmark management */}
          <div className="card space-y-3">
            <p className="text-sm font-semibold text-white">Bookmark Pool ({arBookmarks.length} total)</p>

            <div className="space-y-2">
              <input className="input w-full text-sm" placeholder="Label (e.g. The Giver)" value={newBmLabel} onChange={(e) => setNewBmLabel(e.target.value)} />
              <select className="input w-full text-sm" value={newBmTier} onChange={(e) => setNewBmTier(e.target.value)}>
                <option value="uncommon">Uncommon (gray)</option>
                <option value="rare">Rare (blue)</option>
                <option value="epic">Epic (purple)</option>
                <option value="legendary">Legendary (gold)</option>
              </select>
              <input className="input w-full text-sm" placeholder="Image URL or base64 (optional)" value={newBmUrl} onChange={(e) => setNewBmUrl(e.target.value)} />
              {bmMsg && <p className={`text-xs ${bmMsg.includes("!") ? "text-emerald-400" : "text-red-400"}`}>{bmMsg}</p>}
              <button onClick={addBookmark} disabled={!newBmLabel.trim()} className="btn-primary w-full text-sm">
                Add Bookmark
              </button>
            </div>

            <div className="border-t border-white/5 pt-3">
              <p className="text-xs text-slate-500 mb-2">Or scan <span className="font-mono">public/bookmarks/</span> for files named <span className="font-mono">title.tier.png</span></p>
              <button onClick={scanBookmarks} className="btn-ghost w-full text-sm">Scan Folder</button>
              {scanMsg && <p className="text-xs text-emerald-400 mt-1">{scanMsg}</p>}
            </div>

            {arBookmarks.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto border-t border-white/5 pt-2">
                {arBookmarks.map((bm) => (
                  <div key={bm.id} className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-300">{bm.label}</span>
                    <span className={`${bm.tier === "legendary" ? "text-amber-400" : bm.tier === "epic" ? "text-violet-400" : bm.tier === "rare" ? "text-blue-400" : "text-slate-500"}`}>{bm.tier}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Password List ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white">🔐 Password List</h2>
          <div className="card space-y-3">
            <p className="text-sm text-slate-400">Sends the full password + PIN list to Nephi&apos;s Discord DM. Not displayed here.</p>
            <button
              onClick={async () => {
                const res = await fetch("/api/admin/passwords", { method: "POST" });
                const d = await res.json();
                if (res.ok) alert(`Sent to Discord (${d.userCount} users).`);
                else alert(d.error);
              }}
              className="btn-ghost w-full"
            >
              Send passwords to Nephi&apos;s Discord
            </button>
          </div>
        </section>

        {/* ── Manage Users ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white">👥 Manage Users</h2>

          {users.map((u) => (
            <div key={u.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">
                    {u.username}
                    {u.isAdmin && <span className="ml-2 text-xs text-amber-400">(admin)</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono tracking-widest">PIN: {u.pinPlain || "—"}</p>
                </div>
                <p className="text-sm font-bold text-violet-400">{formatPoints(u.points)} pts</p>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  className="input flex-1 text-sm"
                  placeholder="Amount (+/-)"
                  value={adjustAmounts[u.id] || ""}
                  onChange={(e) =>
                    setAdjustAmounts((prev) => ({ ...prev, [u.id]: e.target.value }))
                  }
                />
                <button
                  onClick={() => adjustPoints(u.id)}
                  disabled={!adjustAmounts[u.id] || loading === u.id}
                  className="btn-primary text-sm"
                >
                  {loading === u.id ? "..." : "Adjust"}
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* ── The House ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">🎰 The House</h2>

          {houseStatus && (
            <div className="card text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Phase</span>
                <span className="font-mono text-violet-300">{houseStatus.phase} / 4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Boss</span>
                <span className={`font-mono ${houseStatus.bossActive ? "text-red-400" : "text-slate-500"}`}>
                  {houseStatus.bossActive ? `ACTIVE — ${houseStatus.bossHp} / ${houseStatus.bossMaxHp} HP` : houseStatus.bossMaxHp > 0 && houseStatus.bossHp <= 0 ? "DEFEATED" : "Offline"}
                </span>
              </div>
            </div>
          )}

          {/* Casino open/close */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Casino Floor</p>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${casinoOpen ? "text-emerald-400 bg-emerald-500/15" : "text-amber-400 bg-amber-500/15"}`}>
                {casinoOpen ? "OPEN" : "CLOSED"}
              </span>
            </div>
            <p className="text-xs text-slate-500">Controls access to the spin wheel and blackjack table. Close between sessions (players still see the House page, just not the games).</p>
            <div className="flex gap-2">
              <button
                onClick={() => toggleCasino(true)}
                disabled={casinoLoading || casinoOpen}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-40"
              >
                {casinoLoading ? "..." : "Open Casino"}
              </button>
              <button
                onClick={() => toggleCasino(false)}
                disabled={casinoLoading || !casinoOpen}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors bg-amber-900/30 border border-amber-800/40 text-amber-400 hover:bg-amber-900/50 disabled:opacity-40"
              >
                {casinoLoading ? "..." : "Close Casino"}
              </button>
            </div>
            {casinoMsg && <p className={`text-xs font-mono ${casinoMsg === "Casino opened." ? "text-emerald-400" : casinoMsg === "Casino closed." ? "text-amber-400" : "text-red-400"}`}>{casinoMsg}</p>}
          </div>

          {/* Public wager bots toggle */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Public Wager Bots</p>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${botsEnabled ? "text-emerald-400 bg-emerald-500/15" : "text-slate-400 bg-slate-500/15"}`}>
                {botsEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <p className="text-xs text-slate-500">Controls whether anonymous bots and opinion bots (The Shark, Momentum Player, The House) join public wagers. Disable if the pool is feeling too inflated.</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setBotsLoading(true); setBotsMsg(null);
                  const res = await fetch("/api/admin/house/bots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true }) });
                  const d = await res.json();
                  setBotsLoading(false);
                  if (res.ok) { setBotsEnabled(true); setBotsMsg("Bots enabled."); }
                  else setBotsMsg(d.error);
                }}
                disabled={botsLoading || botsEnabled}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-40"
              >
                Enable Bots
              </button>
              <button
                onClick={async () => {
                  setBotsLoading(true); setBotsMsg(null);
                  const res = await fetch("/api/admin/house/bots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: false }) });
                  const d = await res.json();
                  setBotsLoading(false);
                  if (res.ok) { setBotsEnabled(false); setBotsMsg("Bots disabled."); }
                  else setBotsMsg(d.error);
                }}
                disabled={botsLoading || !botsEnabled}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors bg-slate-900/30 border border-slate-700/40 text-slate-400 hover:bg-slate-800/50 disabled:opacity-40"
              >
                Disable Bots
              </button>
            </div>
            {botsMsg && <p className="text-xs font-mono text-slate-400">{botsMsg}</p>}
          </div>

          {/* Password leak toggle */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Password Leak</p>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${leakEnabled ? "text-emerald-400 bg-emerald-500/15" : "text-slate-400 bg-slate-500/15"}`}>
                {leakEnabled ? "ON" : "OFF"}
              </span>
            </div>
            <p className="text-xs text-slate-500">Controls whether The House leaks player passwords via achievement holders. Disable to give players a break from account shenanigans.</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setLeakLoading(true); setLeakMsg(null);
                  const res = await fetch("/api/admin/house/leak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true }) });
                  const d = await res.json();
                  setLeakLoading(false);
                  if (res.ok) { setLeakEnabled(true); setLeakMsg("Password leak enabled."); }
                  else setLeakMsg(d.error);
                }}
                disabled={leakLoading || leakEnabled}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-40"
              >
                Enable Leak
              </button>
              <button
                onClick={async () => {
                  setLeakLoading(true); setLeakMsg(null);
                  const res = await fetch("/api/admin/house/leak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: false }) });
                  const d = await res.json();
                  setLeakLoading(false);
                  if (res.ok) { setLeakEnabled(false); setLeakMsg("Password leak disabled."); }
                  else setLeakMsg(d.error);
                }}
                disabled={leakLoading || !leakEnabled}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors bg-slate-900/30 border border-slate-700/40 text-slate-400 hover:bg-slate-800/50 disabled:opacity-40"
              >
                Disable Leak
              </button>
            </div>
            {leakMsg && <p className="text-xs font-mono text-slate-400">{leakMsg}</p>}
          </div>

          {/* Bot win/loss stats */}
          {botStats.length > 0 && (
            <div className="card space-y-3">
              <p className="text-sm font-medium text-white">Bot Performance</p>
              <div className="space-y-2">
                {botStats.map((b) => {
                  const total = b.wins + b.losses;
                  const rate = total > 0 ? Math.round((b.wins / total) * 100) : 0;
                  const emoji = b.name === "The Shark" ? "🦈" : b.name === "The Momentum Player" ? "📊" : "👁️";
                  return (
                    <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                      <div>
                        <span className="mr-1.5">{emoji}</span>
                        <span className="text-slate-300 font-medium">{b.name}</span>
                        {b.lossStreak >= 2 && <span className="ml-2 text-xs text-amber-400 font-mono">⚠ {b.lossStreak} loss streak</span>}
                      </div>
                      <div className="text-right font-mono text-xs space-y-0.5">
                        <div>
                          <span className="text-emerald-400">{b.wins}W</span>
                          <span className="text-slate-600 mx-1">/</span>
                          <span className="text-rose-400">{b.losses}L</span>
                          <span className="text-slate-500 ml-2">({rate}%)</span>
                        </div>
                        <div className="text-slate-500">
                          <span className="text-emerald-500/70">+{b.pointsWon ?? 0}pts</span>
                          <span className="mx-1 text-slate-700">/</span>
                          <span className="text-rose-500/70">-{b.pointsLost ?? 0}pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* World Cup 2026 */}
          <div className="card space-y-3">
            <p className="text-sm font-medium text-white">⚽ World Cup 2026</p>
            <p className="text-xs text-slate-500">Admin preview: June 10 12:00 UTC · Players live: June 11 00:00 UTC</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const res = await fetch("/api/admin/world-cup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "launch" }) });
                  const d = await res.json();
                  if (res.ok) alert(`Launched! Admin live: ${d.adminLiveAt} · Players: ${d.playerLiveAt}`);
                  else alert(d.error);
                }}
                className="btn-primary flex-1"
              >
                Schedule Launch
              </button>
              <button
                onClick={async () => {
                  const res = await fetch("/api/admin/world-cup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) });
                  if (res.ok) alert("World Cup event closed.");
                }}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-white/5 text-slate-400 hover:text-rose-300 border border-white/10"
              >
                Close Event
              </button>
            </div>
          </div>

          {/* World Cup Bracket Infrastructure */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">⚽ Bracket Infrastructure</p>
              <button onClick={loadBracketStatus} className="text-xs text-slate-500 hover:text-white transition-colors">↻ Refresh</button>
            </div>

            {!bracketStatus ? (
              <p className="text-xs text-slate-500">Loading...</p>
            ) : (
              <>
                {/* Event dates */}
                <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Players live</span>
                    <span className="text-white font-mono">{bracketStatus.worldCupPlayerAt ? new Date(bracketStatus.worldCupPlayerAt).toLocaleString() : "Not scheduled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Event entrants</span>
                    <span className="text-white font-mono">{bracketStatus.entryCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Players w/ picks</span>
                    <span className="text-white font-mono">{bracketStatus.pickerCount}</span>
                  </div>
                </div>

                {/* Admin preview entry controls */}
                <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5 space-y-2">
                  <p className="text-xs text-amber-300 font-semibold">⚙️ Admin preview</p>
                  {bracketStatus.adminHasEntry ? (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-slate-400 flex-1">You have a test entry. <a href="/world-cup" target="_blank" className="text-violet-400 underline">Explore the event →</a></p>
                      <button
                        onClick={async () => {
                          setBracketMsg(null);
                          const res = await fetch("/api/admin/world-cup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resetEntry" }) });
                          setBracketMsg(res.ok ? "Test entry removed." : "Error removing entry.");
                          loadBracketStatus();
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-colors whitespace-nowrap"
                      >
                        Remove entry
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No test entry yet. <a href="/world-cup" target="_blank" className="text-violet-400 underline">Go to the event →</a> and enter for free to preview all pages.</p>
                  )}
                </div>

                {/* Lock status */}
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bracketStatus.locked ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"}`}>
                    {bracketStatus.locked ? "🔒 Locked" : "🔓 Open"}
                  </span>
                  {bracketStatus.bracketLockedAt && (
                    <span className="text-xs text-slate-500 font-mono">{new Date(bracketStatus.bracketLockedAt).toLocaleString()}</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={async () => {
                        setBracketMsg(null);
                        const res = await fetch("/api/admin/world-cup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lockBracket" }) });
                        setBracketMsg(res.ok ? "Bracket locked." : "Error locking.");
                        loadBracketStatus();
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors"
                    >
                      Lock now
                    </button>
                    <button
                      onClick={async () => {
                        setBracketMsg(null);
                        const res = await fetch("/api/admin/world-cup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlockBracket" }) });
                        setBracketMsg(res.ok ? "Bracket unlocked." : "Error unlocking.");
                        loadBracketStatus();
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      Unlock
                    </button>
                  </div>
                </div>

                {/* Slot counts per round */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Match slots seeded by cron</p>
                  {["R32", "R16", "QF", "SF", "FINAL"].map((r) => {
                    const info = bracketStatus.byRound[r];
                    const full = info.slotCount >= info.expected;
                    return (
                      <div key={r}>
                        <button
                          onClick={() => setBracketExpandRound(bracketExpandRound === r ? null : r)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 hover:border-white/15 transition-colors"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${full ? "bg-emerald-500" : info.slotCount > 0 ? "bg-amber-500" : "bg-slate-600"}`} />
                          <span className="text-xs font-mono text-white">{r}</span>
                          <span className="text-xs text-slate-500">{info.slotCount}/{info.expected} slots · {info.pickCount} picks</span>
                          <span className="ml-auto text-slate-600 text-xs">{bracketExpandRound === r ? "▲" : "▼"}</span>
                        </button>
                        {bracketExpandRound === r && info.slots.length > 0 && (
                          <div className="mt-1 ml-3 space-y-1">
                            {info.slots.map((s) => {
                              const t1 = bracketStatus.teams.find(t => t.code === s.team1Code);
                              const t2 = bracketStatus.teams.find(t => t.code === s.team2Code);
                              const w = bracketStatus.teams.find(t => t.code === s.winnerCode);
                              return (
                                <div key={s.position} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] text-xs">
                                  <span className="text-slate-600 font-mono w-4">{s.position}</span>
                                  <span>{t1 ? `${t1.flag} ${t1.name}` : s.team1Code || "TBD"}</span>
                                  <span className="text-slate-600">vs</span>
                                  <span>{t2 ? `${t2.flag} ${t2.name}` : s.team2Code || "TBD"}</span>
                                  {w && <span className="ml-auto text-emerald-400">→ {w.flag} {w.name}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {bracketExpandRound === r && info.slots.length === 0 && (
                          <p className="mt-1 ml-3 text-xs text-slate-600 px-3 py-1.5">No slots seeded yet.</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Manual slot seed */}
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Manual slot seed (cron fallback)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Round</p>
                      <select
                        value={seedForm.round}
                        onChange={(e) => setSeedForm(f => ({ ...f, round: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        {["R32", "R16", "QF", "SF", "FINAL"].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Position (0-based)</p>
                      <input type="number" min={0} value={seedForm.position} onChange={(e) => setSeedForm(f => ({ ...f, position: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Team 1 code (e.g. BRA)</p>
                      <input type="text" maxLength={3} placeholder="BRA" value={seedForm.team1Code} onChange={(e) => setSeedForm(f => ({ ...f, team1Code: e.target.value.toUpperCase() }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono uppercase" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Team 2 code (e.g. ARG)</p>
                      <input type="text" maxLength={3} placeholder="ARG" value={seedForm.team2Code} onChange={(e) => setSeedForm(f => ({ ...f, team2Code: e.target.value.toUpperCase() }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono uppercase" />
                    </div>
                  </div>
                  <button
                    disabled={seeding || !seedForm.team1Code || !seedForm.team2Code}
                    onClick={async () => {
                      setSeeding(true); setBracketMsg(null);
                      const res = await fetch("/api/admin/world-cup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "seedSlot", round: seedForm.round, position: parseInt(seedForm.position), team1Code: seedForm.team1Code, team2Code: seedForm.team2Code }),
                      });
                      const d = await res.json();
                      setBracketMsg(res.ok ? `Seeded ${seedForm.round} pos ${seedForm.position}: ${seedForm.team1Code} vs ${seedForm.team2Code}` : (d.error ?? "Error"));
                      setSeeding(false);
                      loadBracketStatus();
                    }}
                    className="btn-primary text-xs w-full disabled:opacity-40"
                  >
                    {seeding ? "Seeding..." : "Seed this slot"}
                  </button>
                </div>

                {/* Team elimination */}
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">
                    Team elimination · {bracketStatus.eliminatedCount} team{bracketStatus.eliminatedCount !== 1 ? "s" : ""} out
                  </p>
                  {/* Currently eliminated */}
                  {bracketStatus.teams.filter(t => t.eliminated).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {bracketStatus.teams.filter(t => t.eliminated).map(t => (
                        <button
                          key={t.id}
                          onClick={async () => {
                            setBracketMsg(null);
                            const res = await fetch("/api/admin/world-cup", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "restoreTeam", teamId: t.id }),
                            });
                            const d = await res.json();
                            setBracketMsg(res.ok ? `Restored ${t.flag} ${t.name}` : (d.error ?? "Error"));
                            loadBracketStatus();
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs hover:bg-rose-500/25 transition-colors"
                          title="Click to restore"
                        >
                          {t.flag} {t.name} <span className="text-rose-500 ml-0.5">↩</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Eliminate dropdown */}
                  <div className="flex gap-2">
                    <select
                      value={elimTeamCode}
                      onChange={(e) => setElimTeamCode(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value="">Select team to eliminate…</option>
                      {bracketStatus.teams.filter(t => !t.eliminated).sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                        <option key={t.id} value={String(t.id)}>{t.flag} {t.name}</option>
                      ))}
                    </select>
                    <button
                      disabled={!elimTeamCode}
                      onClick={async () => {
                        if (!elimTeamCode) return;
                        setBracketMsg(null);
                        const teamId = parseInt(elimTeamCode);
                        const teamName = bracketStatus.teams.find(t => t.id === teamId)?.name ?? elimTeamCode;
                        const res = await fetch("/api/admin/world-cup", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "eliminateTeam", teamId }),
                        });
                        const d = await res.json();
                        setBracketMsg(res.ok ? `Eliminated ${teamName}` : (d.error ?? "Error"));
                        setElimTeamCode("");
                        loadBracketStatus();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs hover:bg-rose-500/30 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      Eliminate
                    </button>
                  </div>
                </div>

                {bracketMsg && (
                  <p className={`text-xs font-mono ${bracketMsg.includes("Error") || bracketMsg.includes("error") ? "text-rose-400" : "text-emerald-400"}`}>{bracketMsg}</p>
                )}
              </>
            )}
          </div>

          {/* Phase selector */}
          <div className="card space-y-3">
            <p className="text-sm font-medium text-white">Set Phase (0–4)</p>
            <p className="text-xs text-slate-500">0=Online · 1=Glitch · 2=Aware · 3=Hostile · 4=Boss</p>
            <div className="flex gap-2">
              {[0,1,2,3,4].map(p => (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors ${
                    houseStatus?.phase === p ? "bg-violet-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Boss HP multiplier */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">Boss HP Multiplier</p>
              <span className="text-xs font-mono text-violet-300">{bossHpMultiplier.toLocaleString()} HP / player</span>
            </div>
            <p className="text-xs text-slate-500">Sets how much HP the boss gets per non-admin player on launch. Default: 3,000. Total HP = multiplier × players + sacrifice bonus.</p>
            <div className="flex gap-2">
              <input
                type="number"
                className="input flex-1 text-sm"
                placeholder="e.g. 3000"
                min={100}
                value={multiplierInput}
                onChange={(e) => setMultiplierInput(e.target.value)}
              />
              <button onClick={setBossMultiplier} className="btn-primary text-sm">Set</button>
            </div>
            {bossControlMsg && <p className={`text-xs font-mono ${bossControlMsg.includes("error") || bossControlMsg.startsWith("Must") ? "text-red-400" : "text-emerald-400"}`}>{bossControlMsg}</p>}
          </div>

          {/* Boss controls */}
          <div className="card space-y-3">
            <p className="text-sm font-medium text-white">Boss Battle</p>
            <button
              onClick={launchBoss}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50"
            >
              ⚡ Launch Boss (Phase → 4, sets HP × players)
            </button>

            {houseStatus?.bossActive && (
              <div className="space-y-2">
                <button
                  onClick={houseStrike}
                  disabled={striking}
                  className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors bg-amber-900/30 border border-amber-700/40 text-amber-400 hover:bg-amber-900/50 disabled:opacity-50"
                >
                  {striking ? "Striking..." : "💥 House Strikes (erase a player's last reward)"}
                </button>
                {strikeResult && (
                  <div className="rounded-lg bg-red-950/40 border border-red-900/40 p-3 text-xs font-mono text-red-300">
                    {strikeResult}
                  </div>
                )}
                <div className="pt-1 space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Adjust Boss HP</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="input flex-1 text-sm"
                      placeholder="e.g. 500 or -200"
                      value={hpDeltaInput}
                      onChange={(e) => setHpDeltaInput(e.target.value)}
                    />
                    <button
                      onClick={() => { const n = parseInt(hpDeltaInput); if (n) { adjustBossHp(n); setHpDeltaInput(""); } }}
                      disabled={!hpDeltaInput}
                      className="btn-primary text-sm"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sacrifice controls */}
          {houseStatus?.phase === 3 && (
            <div className="card space-y-3 border-red-900/40 bg-red-950/10">
              <p className="text-sm font-medium text-red-300">🩸 Sacrifice a Player (Phase 3)</p>

              {sacrificeOpen && sacrificeVotes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Current tally:</p>
                  {sacrificeVotes.map(v => (
                    <div key={v.username} className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300">{v.username}</span>
                      <span className="text-red-400 font-bold">{v.votes} vote{v.votes !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {!sacrificeOpen ? (
                  <button
                    onClick={() => sacrificeAction("open")}
                    disabled={sacrificing}
                    className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-900/30 border border-red-800/40 text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50"
                  >
                    {sacrificing ? "..." : "Open Voting"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => sacrificeAction("execute")}
                      disabled={sacrificing}
                      className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-900/40 border border-red-700/60 text-red-300 hover:bg-red-900/60 transition-colors disabled:opacity-50"
                    >
                      {sacrificing ? "..." : "⚡ Execute"}
                    </button>
                    <button
                      onClick={() => sacrificeAction("close")}
                      disabled={sacrificing}
                      className="flex-1 py-2 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              {sacrificeMsg && <p className={`text-xs font-mono ${sacrificeMsg.startsWith("🩸") ? "text-red-300" : sacrificeMsg === "Vote opened." || sacrificeMsg === "Vote closed." ? "text-emerald-400" : "text-rose-400"}`}>{sacrificeMsg}</p>}
            </div>
          )}

          {houseMsg && <p className={`text-sm font-mono ${houseMsg.includes("error") || houseMsg.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>{houseMsg}</p>}
        </section>

        {/* ── Event Tally ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white flex items-center gap-2">📊 Event Tally</h2>
          {!showTally ? (
            <button onClick={loadTally} className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-colors">
              Load Point Tally
            </button>
          ) : tally && (
            <div className="card space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-emerald-400 font-bold text-lg">{tally.totalIn.toLocaleString()}</p>
                  <p className="text-slate-500">Pts Distributed</p>
                </div>
                <div>
                  <p className="text-rose-400 font-bold text-lg">{tally.totalOut.toLocaleString()}</p>
                  <p className="text-slate-500">Pts Spent/Lost</p>
                </div>
                <div>
                  <p className="text-violet-400 font-bold text-lg">{tally.circulatingTotal.toLocaleString()}</p>
                  <p className="text-slate-500">In Circulation</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">By Category</p>
                {tally.byCategory.map(c => (
                  <div key={c.cat} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                    <span className="text-slate-300">{c.cat}</span>
                    <div className="flex gap-3 text-right">
                      <span className="text-emerald-400">+{c.in.toLocaleString()}</span>
                      <span className="text-rose-400">-{c.out.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Standings</p>
                {tally.standings.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs py-1">
                    <span className="text-slate-600 w-4">{i + 1}.</span>
                    <span className="text-slate-300 flex-1">{p.username}</span>
                    <span className="text-violet-400 font-bold">{p.points.toLocaleString()} pts</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setShowTally(false)} className="text-xs text-slate-500 hover:text-slate-300">Hide</button>
            </div>
          )}
        </section>

        {/* ── Admin Distribution ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white">🎁 Send Distribution</h2>
          <p className="text-xs text-slate-500">Send a claimable reward to all players. They'll see it on their feed until claimed.</p>

          {distMsg && (
            <p className={`text-sm px-3 py-2 rounded-xl ${distMsg.includes("error") || distMsg.includes("Error") ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
              {distMsg}
            </p>
          )}

          <div className="card space-y-3">
            {/* Reward type toggle */}
            <div className="flex gap-2">
              {(["points", "item"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDistRewardType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${
                    distRewardType === t
                      ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "points" ? "💰 Points" : "📦 Item"}
                </button>
              ))}
            </div>

            {distRewardType === "points" ? (
              <input
                type="number"
                className="input w-full"
                placeholder="Points amount"
                value={distAmount}
                onChange={(e) => setDistAmount(e.target.value)}
              />
            ) : (
              <div className="flex gap-2">
                <select className="input flex-1" value={distItem} onChange={(e) => setDistItem(e.target.value)}>
                  <option value="thumb">👍 Thumb on the Scale</option>
                  <option value="ward">🛡️ Ward</option>
                  <option value="xray">💀 PIN Crack</option>
                  <option value="pinreset">🔑 Pin Reset</option>
                  <option value="temp_vpn">🕵️ Temporary VPN</option>
                  <option value="history_viewer">📋 History Viewer</option>
                  <option value="becou">🕊️ Be Cou</option>
                  <option value="stsins">😈 St Sins</option>
                </select>
                <input
                  type="number"
                  min="1"
                  className="input w-20"
                  placeholder="Uses"
                  value={distItemUses}
                  onChange={(e) => setDistItemUses(e.target.value)}
                />
              </div>
            )}

            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Message players will see on their feed..."
              value={distMessage}
              onChange={(e) => setDistMessage(e.target.value)}
            />

            <button
              onClick={sendDistribution}
              disabled={distSending || !distMessage.trim() || (distRewardType === "points" && !distAmount)}
              className="btn-primary w-full"
            >
              {distSending ? "Sending..." : "Send to all players"}
            </button>
          </div>

          {distributions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Recent distributions</p>
              {distributions.map((d) => (
                <div key={d.id} className="card py-2 px-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{d.message}</p>
                    <p className="text-xs text-slate-500">
                      {d.rewardType === "points" ? `${d.rewardAmount.toLocaleString()} pts` : `${d.rewardItem} ×${d.rewardItemUses}`}
                      {" · "}{d.claimCount} claimed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Restart Game ── */}
        {/* ── Database Backup ── */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white">💾 Database Backup</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-slate-400 text-sm leading-snug">
              Downloads a copy of the live SQLite database file. Save it somewhere safe — it contains all users, points, wagers, and game history.
            </p>
            <a
              href="/api/admin/backup"
              download
              className="inline-block px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-sm rounded-xl transition-colors"
            >
              ⬇️ Download backup
            </a>
          </div>
        </section>

        <section className="space-y-3 pb-4">
          <h2 className="font-semibold text-white">🔄 Restart Game</h2>

          {restartError && (
            <div className="card border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-400 font-semibold">Reset failed: {restartError}</p>
              <button onClick={() => setRestartError(null)} className="text-xs text-slate-500 hover:text-slate-300 mt-1">Dismiss</button>
            </div>
          )}

          {restartResult ? (
            <div className="card space-y-3 border-emerald-500/30 bg-emerald-500/5">
              <p className="text-emerald-400 font-semibold">Game restarted! Record saved.</p>
              <p className="text-xs text-slate-500 font-mono">{restartResult.filename}</p>
              <div className="bg-black/30 rounded-lg p-3 max-h-48 overflow-y-auto">
                {restartResult.snapshot.map((line, i) => (
                  <p key={i} className="text-xs font-mono text-slate-300 leading-relaxed">{line || "\u00A0"}</p>
                ))}
              </div>
              <button onClick={() => setRestartResult(null)} className="text-xs text-slate-500 hover:text-slate-300">
                Dismiss
              </button>
            </div>
          ) : !confirmRestart ? (
            <div className="card space-y-3">
              <p className="text-sm text-slate-400">
                Saves a record of current point totals, then deletes all accounts and gameplay data. The nephi admin account is recreated fresh with PIN 0000. Everyone must re-register. Bingo items pool is kept.
              </p>
              <button
                onClick={() => setConfirmRestart(true)}
                className="w-full px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors font-semibold text-sm"
              >
                Restart Game Instance
              </button>
            </div>
          ) : (
            <div className="card space-y-3 border-red-500/30 bg-red-500/5">
              <p className="font-semibold text-red-400">Are you sure? This cannot be undone.</p>
              <p className="text-sm text-slate-400">All accounts deleted. nephi recreated with PIN 0000. Everyone re-registers. Record saved first.</p>
              <div className="flex gap-2">
                <button
                  onClick={restartGame}
                  disabled={restarting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors font-semibold text-sm"
                >
                  {restarting ? "Resetting..." : "Yes, restart"}
                </button>
                <button
                  onClick={() => setConfirmRestart(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <Navbar />
    </div>
  );
}
