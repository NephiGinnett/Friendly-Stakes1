"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { formatPoints } from "@/lib/utils";
import { posLabel } from "@/lib/bingo";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type AdminUser = { id: number; username: string; points: number; isAdmin: boolean; pinPlain: string };
type BingoClaim = { id: number; username: string; position: number; text: string; providerName: string };
type BingoItemRecord = { id: number; text: string; providerName: string };

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

  const fetchAll = () => {
    fetch("/api/admin/users").then((r) => r.ok ? r.json() : []).then(setUsers);
    fetch("/api/admin/bingo/claims").then((r) => r.ok ? r.json() : []).then(setClaims);
    fetch("/api/admin/bingo/items").then((r) => r.ok ? r.json() : []).then(setBingoItems);
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
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {bingoItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-white/5">
                  <span className="flex-1 text-slate-300">{item.text}</span>
                  <span className="shrink-0 text-slate-500">{item.providerName}</span>
                </div>
              ))}
            </div>
          )}
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
      </div>

      <Navbar />
    </div>
  );
}
