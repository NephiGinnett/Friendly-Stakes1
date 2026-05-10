"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type User = { id: number; username: string; points: number; isAdmin: boolean };
type Notifs = { challenges: number; wagers: number };

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [notifs, setNotifs] = useState<Notifs>({ challenges: 0, wagers: 0 });
  const [notifsEnabled, setNotifsEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("notifsEnabled");
      if (stored === "false") setNotifsEnabled(false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));

    if (notifsEnabled) {
      fetch("/api/notifications")
        .then((r) => r.ok ? r.json() : { challenges: 0, wagers: 0 })
        .then(setNotifs)
        .catch(() => {});
    }
  }, [pathname, notifsEnabled]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (!user) return null;

  const navItems = [
    { href: "/feed", label: "Feed", dot: notifs.wagers > 0 },
    { href: "/wagers/new", label: "+" },
    { href: "/shop", label: "Shop" },
    { href: "/achievements", label: "🏆" },
    { href: "/challenges", label: "⚔️", dot: notifs.challenges > 0 },
    { href: "/bingo", label: "🎱" },
    { href: "/profile", label: user.username },
  ];

  if (user.isAdmin) {
    navItems.push({ href: "/admin", label: "Admin" });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/10 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              item.label === "+"
                ? "bg-violet-600 text-white rounded-full w-10 h-10 flex items-center justify-center"
                : pathname === item.href
                ? "text-violet-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {item.label === "+" ? (
              <span className="text-xl leading-none">+</span>
            ) : (
              <span>{item.label}</span>
            )}
            {notifsEnabled && "dot" in item && item.dot && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </Link>
        ))}
        <button
          onClick={logout}
          className="flex flex-col items-center px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
