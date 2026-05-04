"use client";

import Link from "next/link";
import { formatPoints, timeUntil, getStatusBg } from "@/lib/utils";

type WagerEntry = {
  id: number;
  side: string;
  stake: number;
  user: { id: number; username: string };
};

type WagerCardProps = {
  wager: {
    id: number;
    title: string;
    creatorPosition: string;
    creatorStake: number;
    deadline: string;
    status: string;
    creator: { id: number; username: string };
    entries: WagerEntry[];
  };
};

export default function WagerCard({ wager }: WagerCardProps) {
  const forTotal =
    wager.creatorStake +
    wager.entries
      .filter((e) => e.side === "for")
      .reduce((sum, e) => sum + e.stake, 0);
  const againstTotal = wager.entries
    .filter((e) => e.side === "against")
    .reduce((sum, e) => sum + e.stake, 0);
  const totalPool = forTotal + againstTotal;
  const forCount =
    1 + wager.entries.filter((e) => e.side === "for").length;
  const againstCount = wager.entries.filter((e) => e.side === "against").length;

  return (
    <Link href={`/wagers/${wager.id}`} className="card block hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-white leading-snug">{wager.title}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBg(wager.status)}`}>
          {wager.status}
        </span>
      </div>

      <p className="text-sm text-slate-400 mb-3">
        <span className="text-violet-400 font-medium">{wager.creator.username}</span> says:{" "}
        <span className="text-slate-200">{wager.creatorPosition}</span>
      </p>

      <div className="flex items-center gap-3 text-xs mb-2">
        <span className="bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded-full">
          {forCount} for · {formatPoints(forTotal)} pts
        </span>
        {againstCount > 0 ? (
          <span className="bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full">
            {againstCount} against · {formatPoints(againstTotal)} pts
          </span>
        ) : (
          <span className="text-slate-500">No one against yet</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Pool: {formatPoints(totalPool)} pts</span>
        <span>{timeUntil(wager.deadline)}</span>
      </div>
    </Link>
  );
}
