"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDisplayVersion } from "@/lib/version";
import TeamBadges from "@/components/TeamBadges";

type User = { id: number; username: string; points: number; isAdmin: boolean; siteTheme?: string };
type HouseStatus = { worldCupAdminAt: string | null; worldCupPlayerAt: string | null; casinoNightActive?: boolean };
type Notifs = {
  challenges: number;
  wagers: number;
  achievements: number;
  adminBingo: number;
  bingo: string | null;
  boss: boolean;
  distributions: number;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [houseStatus, setHouseStatus] = useState<HouseStatus | null>(null);
  const [notifs, setNotifs] = useState<Notifs>({ challenges: 0, wagers: 0, achievements: 0, adminBingo: 0, bingo: null, boss: false, distributions: 0 });
  const [notifsEnabled, setNotifsEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("notifsEnabled");
      if (stored === "false") setNotifsEnabled(false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (pathname === "/bingo") {
      try { localStorage.setItem("bingoSeenAt", new Date().toISOString()); } catch { /* ignore */ }
    }
  }, [pathname]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
    fetch("/api/house")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setHouseStatus(d))
      .catch(() => {});

    if (!notifsEnabled) return;

    let bingoSeenAt = "";
    try { bingoSeenAt = localStorage.getItem("bingoSeenAt") ?? ""; } catch { /* ignore */ }
    const url = bingoSeenAt
      ? `/api/notifications?bingoSeenAt=${encodeURIComponent(bingoSeenAt)}`
      : "/api/notifications";

    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setNotifs(d))
      .catch(() => {});
  }, [pathname, notifsEnabled]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (!user) return null;

  const isWcTheme = pathname.startsWith("/world-cup") || user.siteTheme === "world-cup";

  const dotMap = {
    feed: notifs.wagers > 0 || notifs.distributions > 0,
    challenges: notifs.challenges > 0,
    achievements: notifs.achievements > 0,
    bingo: notifs.bingo !== null,
    admin: notifs.adminBingo > 0,
    house: notifs.boss,
  };

  const showDot = (key: keyof typeof dotMap) => notifsEnabled && dotMap[key];

  // World Cup visibility check
  const now = new Date();
  const wcAdminAt = houseStatus?.worldCupAdminAt ? new Date(houseStatus.worldCupAdminAt) : null;
  const wcPlayerAt = houseStatus?.worldCupPlayerAt ? new Date(houseStatus.worldCupPlayerAt) : null;
  const showWorldCup = wcAdminAt && wcPlayerAt && (
    (user.isAdmin && now >= wcAdminAt) || now >= wcPlayerAt
  );

  // Casino Night is a simple on/off switch — no time gating, so the floor link
  // appears for everyone the moment an admin flips it live.
  const showCasino = !!houseStatus?.casinoNightActive;

  const navItems: { href: string; label: string; dotKey?: keyof typeof dotMap; isWc?: boolean }[] = [
    { href: "/feed", label: "Feed", dotKey: "feed" },
    { href: "/wagers/new", label: "+" },
    { href: "/shop", label: "Shop" },
    { href: "/achievements", label: "🏆", dotKey: "achievements" },
    { href: "/challenges", label: "⚔️", dotKey: "challenges" },
    { href: "/bingo", label: "🎱", dotKey: "bingo" },
    { href: "/games", label: "🎮" },
    { href: "/house", label: "🎰", dotKey: "house" },
    ...(showCasino ? [{ href: "/casino-night", label: "🎲" }] : []),
    ...(showWorldCup ? [{ href: "/world-cup", label: "⚽", isWc: true }] : []),
    { href: "/profile", label: user.username },
  ];

  if (user.isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", dotKey: "admin" });
  }

  return (
    <nav className={`fixed bottom-0 left-0 right-0 bg-surface border-t z-50 ${
      isWcTheme ? "border-white/30" : "border-white/10"
    }`}>
      {isWcTheme && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/90 rounded-tr-sm" />
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/90 rounded-tl-sm" />
          <div className="absolute left-0 right-0 top-0 h-1 bg-white/90" />
          <div className="absolute left-0 w-3 h-3 top-0 border-l-2 border-t-2 border-white/90" />
          <div className="absolute right-0 w-3 h-3 top-0 border-r-2 border-t-2 border-white/90" />
        </>
      )}
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 relative">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center px-2 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              item.label === "+"
                ? "bg-violet-600 text-white rounded-full w-10 h-10 flex items-center justify-center"
                : pathname === item.href || pathname.startsWith(item.href + "/")
                ? "text-violet-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {item.label === "+" ? (
              <span className="text-xl leading-none">+</span>
            ) : item.isWc ? (
              <TeamBadges />
            ) : (
              <span>{item.label}</span>
            )}
            {item.dotKey && showDot(item.dotKey) && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </Link>
        ))}
        <button
          onClick={logout}
          className="flex flex-col items-center px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300"
        >
          Logout
        </button>
        <span className="absolute right-2 bottom-0.5 text-[9px] text-slate-800 select-none pointer-events-none">
          v{getDisplayVersion(user?.isAdmin ?? false)}
        </span>
      </div>
    </nav>
  );
}
