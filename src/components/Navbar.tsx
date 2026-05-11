"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Notifs = {
  challenges: number;
  wagers: number;
  achievements: number;
  adminBingo: number;
  bingo: string | null;
  boss: boolean;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [notifs, setNotifs] = useState<Notifs>({ challenges: 0, wagers: 0, achievements: 0, adminBingo: 0, bingo: null, boss: false });
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

  const dotMap = {
    feed: notifs.wagers > 0,
    challenges: notifs.challenges > 0,
    achievements: notifs.achievements > 0,
    bingo: notifs.bingo !== null,
    admin: notifs.adminBingo > 0,
    house: notifs.boss,
  };

  const showDot = (key: keyof typeof dotMap) => notifsEnabled && dotMap[key];

  const navItems: { href: string; label: string; dotKey?: keyof typeof dotMap }[] = [
    { href: "/feed", label: "Feed", dotKey: "feed" },
    { href: "/wagers/new", label: "+" },
    { href: "/shop", label: "Shop" },
    { href: "/achievements", label: "🏆", dotKey: "achievements" },
    { href: "/challenges", label: "⚔️", dotKey: "challenges" },
    { href: "/bingo", label: "🎱", dotKey: "bingo" },
    { href: "/house", label: "🎰", dotKey: "house" },
    { href: "/profile", label: user.username },
  ];

  if (user.isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", dotKey: "admin" });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
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
      </div>
    </nav>
  );
}
