"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getTheme } from "@/lib/themes";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [themeId, setThemeId] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u) setThemeId(u.siteTheme ?? "");
      })
      .catch(() => {});
  }, []);

  const isWcPage = pathname.startsWith("/world-cup");
  const activeTheme = isWcPage ? "world-cup" : themeId;
  const theme = getTheme(activeTheme);

  useEffect(() => {
    const root = document.documentElement;

    if (!theme) {
      root.removeAttribute("data-theme");
      root.style.removeProperty("--theme-overlay");
      const vars = ["--bg-base", "--bg-surface", "--accent-primary", "--accent-primary-rgb", "--accent-secondary", "--border-subtle", "--text-muted"];
      vars.forEach((v) => root.style.removeProperty(v));
      return;
    }

    root.setAttribute("data-theme", theme.id);
    Object.entries(theme.css).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    if (theme.overlay) {
      root.style.setProperty("--theme-overlay", theme.overlay);
    } else {
      root.style.removeProperty("--theme-overlay");
    }
  }, [theme]);

  return <>{children}</>;
}
