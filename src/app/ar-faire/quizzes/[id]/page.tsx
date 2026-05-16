"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";
import { formatPoints } from "@/lib/utils";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Question = { id: number; order: number; text: string; choiceA: string; choiceB: string; choiceC: string; correctIndex?: number };
type Quiz = {
  id: number; title: string; author: string; tier: string; imageUrl: string | null;
  sponsor: { id: number; username: string } | null;
  pointReward: number; questions: Question[];
  completed: boolean; attempts: number;
  lastAttempt: { score: number; total: number; passed: boolean } | null;
};

const TIER_COLOR: Record<string, string> = {
  uncommon: "text-slate-400 border-slate-500/50",
  rare: "text-blue-300 border-blue-500/50",
  epic: "text-violet-300 border-violet-500/50",
  legendary: "text-amber-300 border-amber-500/50",
};
const CHOICES = ["A", "B", "C"] as const;

export default function QuizDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; tokensAwarded: number; pointsAwarded: number; correctIndices: number[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    fetch(`/api/ar-faire/quizzes/${params.id}`)
      .then((r) => { if (!r.ok) { router.push("/ar-faire/quizzes"); return null; } return r.json(); })
      .then((q: Quiz) => {
        setQuiz(q);
        setSelected(new Array(q.questions.length).fill(null));
      });
  }, [params.id, router]);

  const submit = async () => {
    if (!quiz) return;
    if (selected.some((s) => s === null)) { setError("Please answer all questions before submitting."); return; }
    setError("");
    setSubmitting(true);
    const res = await fetch(`/api/ar-faire/quizzes/${params.id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: selected }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult(data);
      // Refresh user points
      fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then(setUser);
    } else {
      setError(data.error ?? "Something went wrong");
    }
  };

  if (!user || !quiz) return null;

  const TIER_LABELS: Record<string, string> = { uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/ar-faire/quizzes")} className="text-slate-400 hover:text-white text-sm">&larr; Quizzes</button>
          <PointsBadge points={user.points} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* Header */}
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">{quiz.title}</h2>
              <p className="text-sm text-slate-400">by {quiz.author}</p>
            </div>
            <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium ${TIER_COLOR[quiz.tier]}`}>
              {TIER_LABELS[quiz.tier]}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm flex-wrap">
            {quiz.pointReward > 0 && (
              <span className="text-violet-300">🏆 Pass = {formatPoints(quiz.pointReward)} pts</span>
            )}
            <span className="text-slate-500">🔖 1 token / correct answer</span>
            <span className="text-slate-500">✅ Pass = 70%+</span>
          </div>

          {quiz.sponsor && (
            <p className="text-xs text-slate-500">Sponsored by <span className="text-slate-300">{quiz.sponsor.username}</span></p>
          )}

          {quiz.completed && (
            <div className="bg-emerald-500/10 text-emerald-400 text-sm px-3 py-2 rounded-xl text-center">
              ✓ You already completed this quiz!
            </div>
          )}

          {!quiz.completed && quiz.attempts > 0 && quiz.lastAttempt && (
            <div className="bg-amber-500/10 text-amber-300 text-sm px-3 py-2 rounded-xl">
              Last attempt: {quiz.lastAttempt.score}/{quiz.lastAttempt.total} — {quiz.lastAttempt.passed ? "Passed" : "Failed · one more try"}
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className={`card text-center space-y-3 ${result.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
            <p className={`text-2xl font-bold ${result.passed ? "text-emerald-400" : "text-rose-400"}`}>
              {result.passed ? "✓ Passed!" : "✗ Not quite."}
            </p>
            <p className="text-white font-medium">{result.score}/{result.total} correct</p>
            <div className="flex justify-center gap-4 text-sm">
              {result.tokensAwarded > 0 && <span className="text-violet-300">+{result.tokensAwarded} 🔖 tokens</span>}
              {result.pointsAwarded > 0 && <span className="text-emerald-300">+{formatPoints(result.pointsAwarded)} pts</span>}
            </div>
            {!result.passed && quiz.attempts < 2 && (
              <p className="text-xs text-slate-500">You have one more attempt remaining.</p>
            )}
          </div>
        )}

        {/* Questions — show when not completed and no result yet, or show review after result */}
        {(!quiz.completed || result) && quiz.questions.map((q, qi) => {
          const choices = [q.choiceA, q.choiceB, q.choiceC];
          const isAnswered = result !== null;
          const userChoice = selected[qi];
          const correct = result?.correctIndices[qi];

          return (
            <div key={q.id} className="card space-y-3">
              <p className="text-sm font-medium text-white">
                <span className="text-slate-500 mr-1.5">Q{qi + 1}.</span> {q.text}
              </p>
              <div className="space-y-2">
                {choices.map((choice, ci) => {
                  let bg = "bg-white/5 text-slate-300 hover:bg-white/10";
                  if (isAnswered) {
                    if (ci === correct) bg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
                    else if (ci === userChoice && ci !== correct) bg = "bg-rose-500/20 text-rose-300 border-rose-500/50";
                    else bg = "bg-white/5 text-slate-500";
                  } else if (userChoice === ci) {
                    bg = "bg-violet-500/20 text-violet-200 border-violet-500/50";
                  }
                  return (
                    <button
                      key={ci}
                      disabled={isAnswered || quiz.completed}
                      onClick={() => {
                        if (isAnswered || quiz.completed) return;
                        setSelected((prev) => { const n = [...prev]; n[qi] = ci; return n; });
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border border-transparent transition-all text-sm ${bg}`}
                    >
                      <span className="font-semibold mr-2">{CHOICES[ci]}.</span>{choice}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!quiz.completed && !result && (
          <div className="space-y-2">
            {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
            <button
              onClick={submit}
              disabled={submitting || selected.some((s) => s === null)}
              className="btn-primary w-full"
            >
              {submitting ? "Submitting..." : "Submit Answers"}
            </button>
          </div>
        )}

        {result && (
          <button onClick={() => router.push("/ar-faire/quizzes")} className="btn-ghost w-full">
            Back to Quizzes
          </button>
        )}
      </div>

      <Navbar />
    </div>
  );
}
