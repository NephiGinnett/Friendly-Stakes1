"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PointsBadge from "@/components/PointsBadge";

const EVENT_END = new Date("2026-06-10T00:00:00Z"); // closes when World Cup opens
const EVENT_LAUNCH = new Date("2026-05-16T18:00:00");

type User = { id: number; username: string; points: number; isAdmin: boolean };

export default function ArFairePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState(0);

  const now = new Date();
  const isClosed = now >= EVENT_END;
  const isPreLaunch = now < EVENT_LAUNCH;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => { if (!r.ok) { router.push("/login"); return null; } return r.json(); })
      .then(setUser);
    if (!isClosed) {
      fetch("/api/ar-faire/shop").then((r) => r.ok ? r.json() : null).then((d) => {
        if (d) setTokens(d.tokens ?? 0);
      });
    }
  }, [router, isClosed]);

  if (!user) return null;

  if (isPreLaunch && !user?.isAdmin) {
    return (
      <div className="min-h-screen pb-20 flex flex-col">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">&larr; Back</button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card text-center space-y-3 max-w-sm">
            <p className="text-4xl">📖</p>
            <p className="font-bold text-white text-lg">AR Faire — Coming Soon</p>
            <p className="text-sm text-slate-500">The event opens tonight at 6 PM. Check back then!</p>
          </div>
        </div>
        <Navbar />
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="min-h-screen pb-20 flex flex-col">
        <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">&larr; Back</button>
            <PointsBadge points={user.points} />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card text-center space-y-3 max-w-sm">
            <p className="text-4xl">📖</p>
            <p className="font-bold text-white text-lg">Sorry, the AR Faire is closed now.</p>
            <p className="text-sm text-slate-500">The event ran through July 2026. Perhaps next time you will prioritize reading over wagering.</p>
          </div>
        </div>
        <Navbar />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">AR Faire</h1>
            <p className="text-xs text-slate-500">Limited event · ends Aug 1</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-violet-300 font-medium bg-violet-500/15 px-2.5 py-1 rounded-full">
              🔖 {tokens} tokens
            </span>
            <PointsBadge points={user.points} />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* House flavor text */}
        <div className="card border-violet-500/20 bg-violet-500/5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="text-3xl shrink-0">🏚️</div>
            <div className="space-y-2">
              <p className="text-sm text-violet-200 font-medium leading-snug">
                &ldquo;A word from The House.&rdquo;
              </p>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                It has come to my attention that several of you spend an alarming number of waking hours in here, wagering away your cognitive surplus on outcomes that will not matter in six months.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                I have arranged an <span className="text-violet-300 not-italic font-semibold">Accelerated Reader Faire</span>. You will read books. You will answer questions about them correctly. You will be rewarded.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed italic">
                This is not optional. Your participation is <span className="text-amber-300 not-italic">strongly</span> encouraged. I know where you live. I run this platform.
              </p>
              <p className="text-xs text-slate-600 italic">
                — The House. Your benefactor. Your very invested supervisor.
              </p>
            </div>
          </div>
        </div>

        {/* Nav cards */}
        <Link href="/ar-faire/quizzes" className="card block hover:border-violet-500/40 transition-colors">
          <div className="flex items-center gap-4">
            <span className="text-3xl">📚</span>
            <div>
              <p className="font-semibold text-white">View Available Quizzes</p>
              <p className="text-sm text-slate-500">Answer questions, earn tokens &amp; points</p>
            </div>
            <span className="ml-auto text-slate-500">→</span>
          </div>
        </Link>

        <Link href="/ar-faire/sponsor" className="card block hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center gap-4">
            <span className="text-3xl">✍️</span>
            <div>
              <p className="font-semibold text-white">Sponsor an AR Quiz</p>
              <p className="text-sm text-slate-500">Submit a book quiz · 250 / 500 / 1,000 pts</p>
            </div>
            <span className="ml-auto text-slate-500">→</span>
          </div>
        </Link>

        <Link href="/ar-faire/shop" className="card block hover:border-amber-500/40 transition-colors">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🛒</span>
            <div>
              <p className="font-semibold text-white">Event Shop</p>
              <p className="text-sm text-slate-500">Spend 🔖 tokens · achievements · bookmark gacha</p>
            </div>
            <span className="ml-auto text-slate-500">→</span>
          </div>
        </Link>

        {/* Token explainer */}
        <div className="card bg-slate-500/5 border-slate-500/20 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">How it works</p>
          <ul className="text-xs text-slate-500 space-y-1.5">
            <li>📖 Take a quiz — earn <span className="text-violet-300">1 🔖 token</span> per correct answer</li>
            <li>✅ Pass a quiz (70%+) — earn the <span className="text-violet-300">full points reward</span> · quiz locked forever</li>
            <li>❌ Fail — keep your tokens, try again once more</li>
            <li>🎰 Spend tokens at the Event Shop for bookmarks, points, &amp; achievements</li>
          </ul>
        </div>
      </div>

      <Navbar />
    </div>
  );
}
