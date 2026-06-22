"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useWcSync } from "@/lib/useWcSync";

const ROUNDS = ["R32", "R16", "QF", "SF", "FINAL"] as const;
type Round = typeof ROUNDS[number];

const ROUND_LABELS: Record<Round, string> = {
  R32: "Round of 32", R16: "Round of 16", QF: "Quarter Finals",
  SF: "Semi Finals", FINAL: "Final",
};
const ROUND_POINTS: Record<Round, number> = {
  R32: 5, R16: 10, QF: 20, SF: 40, FINAL: 80,
};
const ROUND_SIZES: Record<Round, number> = {
  R32: 16, R16: 8, QF: 4, SF: 2, FINAL: 1,
};

type Slot = { round: string; position: number; team1Code: string; team2Code: string; winnerCode: string };
type Pick = { round: string; position: number; teamCode: string };
type Team = { code: string; name: string; flag: string };

export default function BracketPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [activeRound, setActiveRound] = useState<Round>("R32");
  const [saving, setSaving] = useState<string | null>(null);

  useWcSync();

  const load = useCallback(async () => {
    const res = await fetch("/api/world-cup/bracket");
    if (res.status === 401) { router.push("/login"); return; }
    const d = await res.json();
    setSlots(d.slots ?? []);
    setPicks(d.picks ?? []);
    setTeams(new Map((d.teams ?? []).map((t: Team) => [t.code, t])));
    setLocked(d.locked ?? false);
    setScore(d.score ?? 0);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const getSlot = (round: Round, pos: number) =>
    slots.find(s => s.round === round && s.position === pos);
  const getPick = (round: Round, pos: number) =>
    picks.find(p => p.round === round && p.position === pos)?.teamCode ?? null;

  // Build the two-team options for each match in any round.
  // R32 comes from BracketSlot. Later rounds come from user's picks of the prior round.
  const getMatchTeams = (round: Round, pos: number): [string, string] => {
    if (round === "R32") {
      const slot = getSlot("R32", pos);
      return [slot?.team1Code ?? "", slot?.team2Code ?? ""];
    }
    const prevRound = ROUNDS[ROUNDS.indexOf(round) - 1];
    const winner1 = getPick(prevRound, pos * 2);
    const winner2 = getPick(prevRound, pos * 2 + 1);
    // Fall back to actual slot data if admin has seeded later rounds
    const slot = getSlot(round, pos);
    return [
      winner1 ?? slot?.team1Code ?? "",
      winner2 ?? slot?.team2Code ?? "",
    ];
  };

  const makePick = async (round: Round, pos: number, teamCode: string) => {
    if (locked) return;
    const key = `${round}-${pos}`;
    setSaving(key);
    // Optimistic update
    setPicks(prev => {
      const next = prev.filter(p => !(p.round === round && p.position === pos));
      return [...next, { round, position: pos, teamCode }];
    });
    // Cascade-invalidate downstream picks if changed
    const current = getPick(round, pos);
    if (current && current !== teamCode) {
      clearDownstream(round, pos, teamCode);
    }
    await fetch("/api/world-cup/bracket/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round, position: pos, teamCode }),
    });
    setSaving(null);
  };

  // When a pick changes, any downstream picks that depended on the old team must be cleared
  const clearDownstream = (changedRound: Round, changedPos: number, newCode: string) => {
    const idx = ROUNDS.indexOf(changedRound);
    if (idx >= ROUNDS.length - 1) return;

    setPicks(prev => {
      let updated = [...prev];
      let currentRoundIdx = idx;
      let currentPos = changedPos;
      let currentCode: string | null = null;

      while (currentRoundIdx < ROUNDS.length - 1) {
        const nextRound = ROUNDS[currentRoundIdx + 1];
        const nextPos = Math.floor(currentPos / 2);
        const nextPick = updated.find(p => p.round === nextRound && p.position === nextPos);
        // The next round's pick used the old team advancing; if it matches, clear it
        if (nextPick && currentRoundIdx === idx) {
          const [t1, t2] = getMatchTeams(nextRound, nextPos);
          if (nextPick.teamCode !== t1 && nextPick.teamCode !== t2 && nextPick.teamCode !== newCode) {
            updated = updated.filter(p => !(p.round === nextRound && p.position === nextPos));
            currentCode = null;
          } else {
            break;
          }
        } else {
          break;
        }
        currentPos = nextPos;
        currentRoundIdx++;
      }
      return updated;
    });
  };

  const teamDisplay = (code: string) => {
    if (!code) return { name: "TBD", flag: "🏴" };
    return teams.get(code) ?? { name: code, flag: "🏳️" };
  };

  const roundComplete = (round: Round) => {
    const size = ROUND_SIZES[round];
    return Array.from({ length: size }, (_, i) => getPick(round, i)).every(Boolean);
  };

  const totalPicks = picks.length;
  const maxPicks = 31; // 16+8+4+2+1

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-[rgb(15,15,22)]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/world-cup" className="text-slate-400 hover:text-white text-sm transition-colors">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white leading-tight">🏆 Build-a-Bracket</h1>
            <p className="text-slate-500 text-xs">
              {locked ? "🔒 Bracket locked" : `${totalPicks}/${maxPicks} picks · ${score} pts earned`}
            </p>
          </div>
          {score > 0 && (
            <span className="text-emerald-400 text-xs font-bold font-mono">{score} pts</span>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Intro */}
        {!locked && totalPicks === 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-xs text-emerald-300 leading-relaxed">
            Pick the winner of every match from R32 through the Final. Earn <span className="font-bold">5→80 pts</span> per correct call.
            Picks lock when the Round of 32 begins.
          </div>
        )}

        {locked && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300 text-center">
            🔒 Bracket is locked — your picks are set. Results update as matches finish.
          </div>
        )}

        {/* Round tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
          {ROUNDS.map(r => {
            const done = roundComplete(r);
            return (
              <button
                key={r}
                onClick={() => setActiveRound(r)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors relative ${
                  activeRound === r
                    ? "bg-violet-600 text-white"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {r}
                {done && <span className="absolute -top-1 -right-1 text-[8px]">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Round header */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-white font-semibold text-sm">{ROUND_LABELS[activeRound]}</h2>
          <span className="text-slate-600 text-xs font-mono">+{ROUND_POINTS[activeRound]} pts each</span>
        </div>

        {/* Matches */}
        <div className="space-y-2">
          {Array.from({ length: ROUND_SIZES[activeRound] }, (_, pos) => {
            const [code1, code2] = getMatchTeams(activeRound, pos);
            const pick = getPick(activeRound, pos);
            const actualSlot = getSlot(activeRound, pos);
            const actualWinner = actualSlot?.winnerCode ?? "";
            const isSaving = saving === `${activeRound}-${pos}`;
            const t1 = teamDisplay(code1);
            const t2 = teamDisplay(code2);
            const hasBothTeams = !!code1 && !!code2;

            return (
              <div key={pos} className={`bg-white/5 border rounded-xl overflow-hidden transition-colors ${
                !hasBothTeams ? "border-white/5 opacity-50" : "border-white/10"
              }`}>
                <div className="flex items-stretch divide-x divide-white/10">
                  {/* Team 1 */}
                  <button
                    onClick={() => hasBothTeams && !locked && code1 && makePick(activeRound, pos, code1)}
                    disabled={!hasBothTeams || locked || isSaving}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-3 text-left transition-colors disabled:cursor-default ${
                      pick === code1
                        ? actualWinner === code1
                          ? "bg-emerald-500/20"
                          : actualWinner && actualWinner !== code1
                          ? "bg-red-500/10"
                          : "bg-violet-500/20"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-xl leading-none">{t1.flag}</span>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold leading-tight truncate ${pick === code1 ? "text-white" : "text-slate-300"}`}>
                        {t1.name}
                      </div>
                      {pick === code1 && (
                        <div className="text-[10px] mt-0.5">
                          {actualWinner === code1 ? "✅ Correct" : actualWinner && actualWinner !== code1 ? "❌ Eliminated" : "⚡ Your pick"}
                        </div>
                      )}
                    </div>
                    {pick === code1 && <span className="ml-auto text-violet-400 text-sm">●</span>}
                  </button>

                  {/* VS divider */}
                  <div className="flex items-center justify-center w-8 shrink-0">
                    <span className="text-slate-600 text-[10px] font-mono">VS</span>
                  </div>

                  {/* Team 2 */}
                  <button
                    onClick={() => hasBothTeams && !locked && code2 && makePick(activeRound, pos, code2)}
                    disabled={!hasBothTeams || locked || isSaving}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-3 text-right flex-row-reverse transition-colors disabled:cursor-default ${
                      pick === code2
                        ? actualWinner === code2
                          ? "bg-emerald-500/20"
                          : actualWinner && actualWinner !== code2
                          ? "bg-red-500/10"
                          : "bg-violet-500/20"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-xl leading-none">{t2.flag}</span>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold leading-tight truncate ${pick === code2 ? "text-white" : "text-slate-300"}`}>
                        {t2.name}
                      </div>
                      {pick === code2 && (
                        <div className="text-[10px] mt-0.5 text-right">
                          {actualWinner === code2 ? "✅ Correct" : actualWinner && actualWinner !== code2 ? "❌ Eliminated" : "⚡ Your pick"}
                        </div>
                      )}
                    </div>
                    {pick === code2 && <span className="mr-auto text-violet-400 text-sm">●</span>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next round nudge */}
        {roundComplete(activeRound) && activeRound !== "FINAL" && (
          <button
            onClick={() => setActiveRound(ROUNDS[ROUNDS.indexOf(activeRound) + 1])}
            className="w-full py-2.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-semibold rounded-xl hover:bg-violet-600/30 transition-colors"
          >
            {ROUND_LABELS[ROUNDS[ROUNDS.indexOf(activeRound) + 1]]} →
          </button>
        )}

        {/* Score breakdown */}
        {score > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">Bracket Score</p>
            {ROUNDS.map(r => {
              const roundPicks = picks.filter(p => p.round === r);
              const correct = roundPicks.filter(p => {
                const slot = getSlot(r, p.position);
                return slot?.winnerCode && slot.winnerCode === p.teamCode;
              });
              if (correct.length === 0) return null;
              return (
                <div key={r} className="flex justify-between text-xs">
                  <span className="text-slate-500">{ROUND_LABELS[r]}</span>
                  <span className="text-emerald-400 font-mono">+{correct.length * ROUND_POINTS[r]} pts</span>
                </div>
              );
            })}
            <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2">
              <span className="text-white">Total</span>
              <span className="text-emerald-400">{score} pts</span>
            </div>
          </div>
        )}
      </div>

      <Navbar />
    </div>
  );
}
