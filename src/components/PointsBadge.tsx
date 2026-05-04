"use client";

import { formatPoints } from "@/lib/utils";

export default function PointsBadge({ points }: { points: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-violet-500/15 text-violet-300 px-3 py-1 rounded-full text-sm font-medium">
      <span className="text-violet-400">&#9670;</span>
      {formatPoints(points)} pts
    </div>
  );
}
