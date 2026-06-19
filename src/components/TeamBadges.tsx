"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BadgeTeam = {
  id: number;
  name: string;
  flag: string;
  code: string;
  eliminated: boolean;
};

type BadgeData = {
  team: BadgeTeam | null;
  proxy: BadgeTeam | null;
};

export default function TeamBadges() {
  const [data, setData] = useState<BadgeData | null>(null);

  useEffect(() => {
    fetch("/api/world-cup/my-badges")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || !data.team) return null;

  return (
    <div className="flex items-center gap-1.5">
      {/* Gold badge — main team */}
      <Link
        href="/world-cup/team"
        title={`${data.team.name} — Your team`}
        className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
          data.team.eliminated
            ? "border-slate-500/50 bg-slate-500/10 opacity-60"
            : "border-amber-400/70 bg-amber-400/10 hover:bg-amber-400/20"
        }`}
      >
        <span className="text-sm leading-none">{data.team.flag}</span>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-[rgb(15,15,22)]" />
      </Link>

      {/* Silver badge — proxy team */}
      {data.proxy && (
        <Link
          href="/world-cup/team"
          title={`${data.proxy.name} — Proxy team`}
          className={`relative flex items-center justify-center w-7 h-7 rounded-full border-2 transition-colors ${
            data.proxy.eliminated
              ? "border-slate-500/50 bg-slate-500/10 opacity-60"
              : "border-slate-300/50 bg-slate-300/10 hover:bg-slate-300/20"
          }`}
        >
          <span className="text-xs leading-none">{data.proxy.flag}</span>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-slate-300 border border-[rgb(15,15,22)]" />
        </Link>
      )}
    </div>
  );
}
