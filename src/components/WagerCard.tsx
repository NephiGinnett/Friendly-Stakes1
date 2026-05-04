"use client";

import Link from "next/link";
import { formatPoints, timeUntil, getStatusBg } from "@/lib/utils";

type WagerCardProps = {
  wager: {
    id: number;
    title: string;
    creatorPosition: string;
    creatorStake: number;
    acceptorStake: number | null;
    deadline: string;
    status: string;
    creator: { id: number; username: string };
    acceptor: { id: number; username: string } | null;
    _count?: { counterOffers: number };
  };
};

export default function WagerCard({ wager }: WagerCardProps) {
  return (
    <Link href={`/wagers/${wager.id}`} className="card block hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-white leading-snug">{wager.title}</h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBg(wager.status)}`}>
          {wager.status}
        </span>
      </div>

      <p className="text-sm text-slate-400 mb-3">
        <span className="text-violet-400 font-medium">{wager.creator.username}</span> bets{" "}
        <span className="text-white font-medium">{formatPoints(wager.creatorStake)} pts</span> that{" "}
        <span className="text-slate-200">{wager.creatorPosition}</span>
      </p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          {wager.acceptor ? (
            <span>
              vs <span className="text-sky-400">{wager.acceptor.username}</span>{" "}
              ({formatPoints(wager.acceptorStake!)} pts)
            </span>
          ) : (
            <span className="text-amber-400">Waiting for opponent</span>
          )}
        </div>
        <span>{timeUntil(wager.deadline)}</span>
      </div>

      {wager._count && wager._count.counterOffers > 0 && (
        <div className="mt-2 text-xs text-violet-400">
          {wager._count.counterOffers} counter-offer{wager._count.counterOffers > 1 ? "s" : ""}
        </div>
      )}
    </Link>
  );
}
