export function formatPoints(points: number): string {
  return points.toLocaleString();
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeUntil(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "text-violet-400";
    case "accepted":
      return "text-sky-400";
    case "voting":
      return "text-amber-400";
    case "settled":
      return "text-emerald-400";
    case "cancelled":
      return "text-slate-500";
    default:
      return "text-slate-400";
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case "open":
      return "bg-violet-500/20 text-violet-300";
    case "accepted":
      return "bg-sky-500/20 text-sky-300";
    case "voting":
      return "bg-amber-500/20 text-amber-300";
    case "settled":
      return "bg-emerald-500/20 text-emerald-300";
    case "cancelled":
      return "bg-slate-500/20 text-slate-400";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
}

export function impliedOdds(stake1: number, stake2: number): string {
  if (stake1 === stake2) return "Even";
  const ratio = Math.max(stake1, stake2) / Math.min(stake1, stake2);
  if (stake1 > stake2) return `${ratio.toFixed(1)}:1 (creator favored)`;
  return `${ratio.toFixed(1)}:1 (acceptor favored)`;
}
