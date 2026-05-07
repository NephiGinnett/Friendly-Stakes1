"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { posLabel } from "@/lib/bingo";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type BingoSquare = {
  id: number;
  position: number;
  text: string;
  providerName: string;
  claimStatus: "none" | "pending" | "approved";
};

export default function BingoPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [squares, setSquares] = useState<BingoSquare[]>([]);
  const [needsItems, setNeedsItems] = useState(false);
  const [selected, setSelected] = useState<BingoSquare | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");

  const fetchCard = () => {
    fetch("/api/bingo/card")
      .then((r) => r.json())
      .then((data) => {
        setSquares(data.squares ?? []);
        setNeedsItems(data.needsItems ?? false);
      });
  };

  const fetchUser = () => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then((u) => { if (u) { setUser(u); fetchCard(); } });
  }, [router]);

  const openSquare = (s: BingoSquare) => {
    setSelected(s);
    setClaimMsg("");
  };

  const claim = async (square: BingoSquare) => {
    setClaiming(true);
    setClaimMsg("");
    const res = await fetch("/api/bingo/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ squareId: square.id }),
    });
    const data = await res.json();
    setClaiming(false);
    if (res.ok) {
      setClaimMsg("Submitted! Waiting for admin confirmation.");
      fetchCard();
      fetchUser();
    } else {
      setClaimMsg(data.error ?? "Something went wrong.");
    }
  };

  if (!user) return null;

  const COLS = ["B", "I", "N", "G", "O"];
  const approvedCount = squares.filter((s) => s.claimStatus === "approved").length;
  const pendingCount = squares.filter((s) => s.claimStatus === "pending").length;

  const squareBg = (s: BingoSquare) => {
    if (s.claimStatus === "approved") return "bg-slate-800/70 border-slate-700/60";
    if (s.claimStatus === "pending") return "bg-amber-500/15 border-amber-500/40";
    return "bg-surface border-white/10 hover:border-violet-500/50 active:scale-95 cursor-pointer";
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Bingo</h1>
            <p className="text-xs text-slate-500">
              {approvedCount}/25 claimed
              {pendingCount > 0 && (
                <span className="ml-2 text-amber-400">{pendingCount} pending</span>
              )}
            </p>
          </div>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-3 pt-4">
        {needsItems && (
          <div className="card text-center py-10 space-y-2">
            <p className="text-4xl">🎱</p>
            <p className="font-semibold text-white">No bingo items yet</p>
            <p className="text-sm text-slate-500">Ask the admin to add items to the pool.</p>
          </div>
        )}

        {squares.length > 0 && (
          <>
            {/* Column letters */}
            <div className="grid grid-cols-5 gap-1 mb-1">
              {COLS.map((c) => (
                <div key={c} className="text-center text-xl font-black text-violet-400 py-0.5">
                  {c}
                </div>
              ))}
            </div>

            {/* 5×5 grid */}
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 25 }, (_, i) => {
                const s = squares.find((sq) => sq.position === i);
                if (!s) {
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-lg bg-slate-800/40 border border-white/5"
                    />
                  );
                }
                return (
                  <button
                    key={i}
                    onClick={() => openSquare(s)}
                    className={`aspect-square flex items-center justify-center p-1 rounded-lg border transition-all ${squareBg(s)}`}
                    title={posLabel(s.position)}
                  >
                    {s.claimStatus === "approved" ? (
                      <span className="text-2xl">⭐</span>
                    ) : s.claimStatus === "pending" ? (
                      <span className="text-lg">⏳</span>
                    ) : (
                      <span className="text-[8px] leading-tight text-slate-300 line-clamp-3 break-words text-center px-0.5">
                        {s.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-600 text-center mt-3">
              Tap a square to view details and claim
            </p>

            {approvedCount === 25 && (
              <div className="mt-4 card bg-violet-500/10 border-violet-500/30 text-center py-4">
                <p className="text-2xl mb-1">⬛</p>
                <p className="font-bold text-violet-300 text-lg">BLACKOUT!</p>
                <p className="text-sm text-slate-400">You claimed every square!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Square detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="card w-full max-w-lg space-y-4 mb-2">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-white font-semibold text-base leading-snug">{selected.text}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Suggested by{" "}
                  <span className="text-slate-400">{selected.providerName}</span>
                  <span className="ml-2 text-slate-600">{posLabel(selected.position)}</span>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-slate-300 text-2xl leading-none shrink-0"
              >
                ×
              </button>
            </div>

            {selected.claimStatus === "approved" && (
              <div className="bg-emerald-500/10 text-emerald-400 text-sm px-3 py-2 rounded-xl text-center">
                ⭐ Claimed and confirmed!
              </div>
            )}

            {selected.claimStatus === "pending" && (
              <div className="bg-amber-500/10 text-amber-300 text-sm px-3 py-2 rounded-xl text-center">
                ⏳ Waiting for admin confirmation...
              </div>
            )}

            {selected.claimStatus === "none" && (
              <>
                {claimMsg ? (
                  <div className="bg-violet-500/10 text-violet-300 text-sm px-3 py-2 rounded-xl text-center">
                    {claimMsg}
                  </div>
                ) : (
                  <button
                    onClick={() => claim(selected)}
                    disabled={claiming}
                    className="btn-primary w-full"
                  >
                    {claiming ? "Submitting..." : "Claim this square"}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setSelected(null)}
              className="w-full text-sm text-slate-600 hover:text-slate-400 py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}
