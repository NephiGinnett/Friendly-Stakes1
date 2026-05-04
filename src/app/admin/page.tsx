"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { formatPoints } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type AdminUser = { id: number; username: string; points: number; isAdmin: boolean; createdAt: string };

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adjustAmounts, setAdjustAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<number | null>(null);

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

    fetch("/api/admin/users")
      .then((r) => r.ok ? r.json() : [])
      .then(setUsers);
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
      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, points: updated.points } : u))
      );
      setAdjustAmounts((prev) => ({ ...prev, [targetId]: "" }));
    }
    setLoading(null);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-amber-400">Admin Panel</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        <h2 className="font-semibold text-white">Manage Users</h2>

        {users.map((u) => (
          <div key={u.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">
                  {u.username}
                  {u.isAdmin && <span className="ml-2 text-xs text-amber-400">(admin)</span>}
                </p>
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
      </div>

      <Navbar />
    </div>
  );
}
