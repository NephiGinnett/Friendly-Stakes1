"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";

type User = { id: number; username: string; points: number; isAdmin: boolean };

export default function NewWagerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("");
  const [stake, setStake] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const stakeNum = parseInt(stake);
    if (!stakeNum || stakeNum < 1) { setError("Enter a valid stake"); return; }
    if (user && stakeNum > user.points) { setError("Not enough points"); return; }

    const deadline = new Date(`${deadlineDate}T${deadlineTime || "23:59"}`);
    if (deadline <= new Date()) { setError("Deadline must be in the future"); return; }

    setLoading(true);

    try {
      const res = await fetch("/api/wagers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          creatorPosition: position,
          creatorStake: stakeNum,
          deadline: deadline.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create wager");
        return;
      }

      const wager = await res.json();
      router.push(`/wagers/${wager.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">New Wager</h1>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="title" className="label">What&apos;s the event?</label>
            <input
              id="title"
              className="input"
              placeholder="e.g. Who wins at pool tonight?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="label">Details (optional)</label>
            <textarea
              id="description"
              className="input min-h-[80px] resize-none"
              placeholder="Any extra context for the wager..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="position" className="label">Your prediction</label>
            <input
              id="position"
              className="input"
              placeholder="e.g. I think Dave will win"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="stake" className="label">
              Your stake (you have {user.points.toLocaleString()} pts)
            </label>
            <input
              id="stake"
              type="number"
              className="input"
              placeholder="100"
              min={1}
              max={user.points}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="deadlineDate" className="label">Deadline date</label>
              <input
                id="deadlineDate"
                type="date"
                className="input"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="deadlineTime" className="label">Time (optional)</label>
              <input
                id="deadlineTime"
                type="time"
                className="input"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !title || !position || !stake || !deadlineDate}
            className="btn-primary w-full"
          >
            {loading ? "Creating..." : "Post Wager"}
          </button>
        </form>
      </div>

      <Navbar />
    </div>
  );
}
