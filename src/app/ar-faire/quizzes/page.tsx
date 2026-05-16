"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Quiz = {
  id: number; title: string; author: string; tier: string; status: string;
  sponsor: { id: number; username: string } | null;
  questionCount: number; completed: boolean; attempts: number; bestScore: number | null;
};

const TIER_LABEL: Record<string, string> = { uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const TIER_COLOR: Record<string, string> = {
  uncommon: "text-slate-400 bg-slate-500/20",
  rare: "text-blue-300 bg-blue-500/20",
  epic: "text-violet-300 bg-violet-500/20",
  legendary: "text-amber-300 bg-amber-500/20",
};
const TIER_POINTS: Record<string, number> = { uncommon: 50, rare: 250, epic: 500, legendary: 1000 };

export default function QuizzesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [tokens, setTokens] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch("/api/ar-faire/quizzes").then((r) => r.json()).then(setQuizzes);
    fetch("/api/ar-faire/shop").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setTokens(d.tokens); });
  }, [router]);

  if (!user) return null;

  const available = quizzes.filter((q) => !q.completed);
  const completed = quizzes.filter((q) => q.completed);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/ar-faire")} className="text-slate-400 hover:text-white text-sm">&larr; AR Faire</button>
            <h1 className="text-lg font-bold text-white mt-0.5">Available Quizzes</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full">🔖 {tokens}</span>
            <PointsBadge points={user.points} />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-6">
        {available.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-white">Available ({available.length})</h2>
            {available.map((q) => (
              <Link key={q.id} href={`/ar-faire/quizzes/${q.id}`} className="card block hover:border-violet-500/40 transition-colors space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{q.title}</p>
                    <p className="text-xs text-slate-500">by {q.author}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLOR[q.tier]}`}>
                      {TIER_LABEL[q.tier]}
                    </span>
                    {TIER_POINTS[q.tier] > 0 && (
                      <span className="text-xs text-slate-400">{formatPoints(TIER_POINTS[q.tier])} pts</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{q.questionCount} questions</span>
                  {q.sponsor && <span>Sponsored by <span className="text-slate-400">{q.sponsor.username}</span></span>}
                  {q.attempts > 0 && <span className="text-amber-400">{q.attempts} attempt{q.attempts !== 1 ? "s" : ""}</span>}
                </div>
              </Link>
            ))}
          </section>
        )}

        {completed.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-emerald-400">✓ Completed ({completed.length})</h2>
            {completed.map((q) => (
              <Link key={q.id} href={`/ar-faire/quizzes/${q.id}`} className="card block opacity-60 hover:opacity-100 transition-opacity space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-white text-sm">{q.title}</p>
                    <p className="text-xs text-slate-500">by {q.author}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLOR[q.tier]}`}>
                    {TIER_LABEL[q.tier]}
                  </span>
                </div>
                <p className="text-xs text-emerald-400">
                  Completed · best {q.bestScore}/{q.questionCount}
                </p>
              </Link>
            ))}
          </section>
        )}

        {quizzes.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl">📖</p>
            <p className="font-semibold text-white">No quizzes yet</p>
            <p className="text-sm text-slate-500">Be the first to sponsor one!</p>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
