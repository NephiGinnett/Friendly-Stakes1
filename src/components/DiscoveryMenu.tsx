"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ALL_PAGES, VALID_SLUGS, groupBySection, DiscoveryPage } from "@/lib/discovery";

export default function DiscoveryMenu() {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const pathname = usePathname();
  const lastTracked = useRef<string>("");

  // Auto-track current page
  useEffect(() => {
    if (!pathname || lastTracked.current === pathname) return;
    if (!VALID_SLUGS.has(pathname)) return;
    lastTracked.current = pathname;

    fetch("/api/discovery/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: pathname }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setVisited(d.visited); });
  }, [pathname]);

  // Load visited on mount
  useEffect(() => {
    fetch("/api/discovery/pages")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setVisited(d.visited); });
  }, []);

  if (visited.length === 0 && !open) return null;

  const sections = groupBySection(ALL_PAGES);
  const discoveredSet = new Set(visited);

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {open && (
        <div className="mb-2 w-56 max-h-[70vh] overflow-y-auto rounded-2xl bg-[rgb(13,13,20)]/98 backdrop-blur-lg border border-white/10 shadow-2xl p-3 space-y-3">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">Discovered</p>

          {Object.entries(sections).map(([section, pages]) => {
            const discovered = pages.filter((p: DiscoveryPage) => discoveredSet.has(p.slug));
            const hidden = pages.filter((p: DiscoveryPage) => !discoveredSet.has(p.slug));
            if (discovered.length === 0 && hidden.length === 0) return null;

            return (
              <div key={section}>
                <p className="text-xs text-slate-600 px-1 mb-1">{section}</p>
                {discovered.map((p: DiscoveryPage) => (
                  <Link
                    key={p.slug}
                    href={p.slug}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors ${
                      pathname === p.slug ? "bg-white/5" : ""
                    }`}
                  >
                    <span className="text-sm">{p.emoji}</span>
                    <span className="text-xs text-slate-300">{p.label}</span>
                    {pathname === p.slug && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                  </Link>
                ))}
                {hidden.length > 0 && discovered.length > 0 && (
                  <div className="opacity-30 mt-0.5">
                    {hidden.map((p: DiscoveryPage) => (
                      <div key={p.slug} className="flex items-center gap-2 px-2 py-1 rounded-lg">
                        <span className="text-sm">❓</span>
                        <span className="text-xs text-slate-600">???</span>
                      </div>
                    ))}
                  </div>
                )}
                {hidden.length > 0 && discovered.length === 0 && (
                  <div className="flex items-center gap-2 px-2 py-1.5 opacity-25">
                    <span className="text-sm">❓</span>
                    <span className="text-xs text-slate-600">{section} — undiscovered</span>
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-xs text-slate-700 px-1 text-center">
            {visited.length} / {ALL_PAGES.length} discovered
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-full bg-[rgb(13,13,20)] border border-white/10 shadow-lg flex items-center justify-center text-base hover:border-white/20 transition-colors relative"
        title="Discovery"
      >
        🗺️
        {visited.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
            {visited.length}
          </span>
        )}
      </button>
    </div>
  );
}
