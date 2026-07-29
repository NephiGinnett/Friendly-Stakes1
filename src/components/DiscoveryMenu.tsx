"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ALL_PAGES, VALID_SLUGS, groupBySection, DiscoveryPage } from "@/lib/discovery";

export default function DiscoveryMenu() {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const [bossActive, setBossActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [wc, setWc] = useState<{ adminAt: string | null; playerAt: string | null; endAt: string | null }>({ adminAt: null, playerAt: null, endAt: null });
  const pathname = usePathname();
  const lastTracked = useRef<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    fetch("/api/discovery/pages")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setVisited(d.visited); });
    fetch("/api/house")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setBossActive(!!d.bossActive);
        setWc({ adminAt: d.worldCupAdminAt ?? null, playerAt: d.worldCupPlayerAt ?? null, endAt: d.worldCupEventEndAt ?? null });
      });
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((u) => { if (u) setIsAdmin(!!u.isAdmin); });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // World Cup pages only belong in the nav while the event is live (started
  // and not past its end time); admins see it during the pre-player preview.
  const now = new Date();
  const wcStarted = !!(
    (isAdmin && wc.adminAt && now >= new Date(wc.adminAt)) || (wc.playerAt && now >= new Date(wc.playerAt))
  );
  const wcLive = wcStarted && (!wc.endAt || now < new Date(wc.endAt));

  const visiblePages = ALL_PAGES.filter((p) => {
    // Boss Battle only belongs in the nav while the boss is actually active.
    if (p.slug === "/house/boss" && !bossActive) return false;
    if (p.section === "World Cup" && !wcLive) return false;
    return true;
  });
  const sections = groupBySection(visiblePages);

  return (
    <div ref={menuRef} className="fixed top-3 right-3 z-[60]">
      <button onClick={() => setOpen((o) => !o)}
        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all ${
          open
            ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
            : "bg-[rgb(20,20,30)] border border-white/10 text-slate-400 hover:text-white hover:border-white/20"
        }`}
        title="Navigate">
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="absolute top-11 right-0 w-60 max-h-[80vh] overflow-y-auto rounded-2xl bg-[rgb(13,13,20)] border border-white/10 shadow-2xl p-3 space-y-3">
          {Object.entries(sections).map(([section, pages]) => (
            <div key={section}>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-2 mb-1">{section}</p>
              {pages.map((p: DiscoveryPage) => (
                <Link key={p.slug} href={p.slug} onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                    pathname === p.slug
                      ? "bg-violet-500/15 text-violet-300"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}>
                  <span className="text-sm w-5 text-center">{p.emoji}</span>
                  <span className="text-xs">{p.label}</span>
                  {pathname === p.slug && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                </Link>
              ))}
            </div>
          ))}
          <div className="border-t border-white/5 pt-2">
            <p className="text-[10px] text-slate-700 text-center">
              {visited.length} / {ALL_PAGES.length} pages visited
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
