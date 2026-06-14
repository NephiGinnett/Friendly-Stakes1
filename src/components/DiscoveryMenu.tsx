"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CASINO_PAGES, DiscoveryPage } from "@/lib/casinoNight";

export default function DiscoveryMenu() {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const [casinoActive, setCasinoActive] = useState(false);

  useEffect(() => {
    // Only show if casino night is active
    fetch("/api/casino/scratch")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setCasinoActive(d.casinoActive);
        if (d.casinoActive) {
          fetch("/api/casino/pages")
            .then((r) => r.ok ? r.json() : null)
            .then((pd) => { if (pd) setVisited(pd.visited); });
        }
      });
  }, []);

  if (!casinoActive) return null;

  const discoveredPages = CASINO_PAGES.filter((p) => visited.includes(p.slug));
  const undiscovered = CASINO_PAGES.filter((p) => !visited.includes(p.slug));

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {open && (
        <div className="mb-2 w-52 rounded-2xl bg-[rgb(18,18,28)]/95 backdrop-blur-lg border border-white/10 shadow-2xl p-3 space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">Casino Night</p>
          {discoveredPages.length === 0 && (
            <p className="text-xs text-slate-600 px-1">No pages discovered yet.</p>
          )}
          {discoveredPages.map((p: DiscoveryPage) => (
            <Link
              key={p.slug}
              href={p.slug}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className="text-base">{p.emoji}</span>
              <span className="text-sm text-slate-300">{p.label}</span>
            </Link>
          ))}
          {undiscovered.length > 0 && (
            <div className="border-t border-white/5 pt-2">
              {undiscovered.map((p: DiscoveryPage) => (
                <div key={p.slug} className="flex items-center gap-2 px-2 py-1.5 opacity-40">
                  <span className="text-base">❓</span>
                  <span className="text-sm text-slate-600">???</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full bg-[rgb(18,18,28)] border border-white/10 shadow-lg flex items-center justify-center text-lg hover:border-white/20 transition-colors"
        title="Casino Night"
      >
        🎰
      </button>
    </div>
  );
}
