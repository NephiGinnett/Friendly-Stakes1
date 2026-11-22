"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { endDemo, isDemoActive } from "@/lib/demo/client";

// Pages that work in the guest demo. Anything else (shop, casino, admin…)
// sends the guest back to the feed rather than showing a half-empty page.
const DEMO_PAGES = [/^\/feed$/, /^\/wagers\/new$/, /^\/wagers\/\d+$/, /^\/profile$/, /^\/demo$/];

export function useDemoActive(): boolean {
  const [active, setActive] = useState(false);
  const pathname = usePathname();
  useEffect(() => setActive(isDemoActive()), [pathname]);
  return active;
}

export default function DemoMode() {
  const pathname = usePathname();
  const router = useRouter();
  const active = useDemoActive();

  useEffect(() => {
    if (!isDemoActive()) return;
    // Heading to the real sign-in means the guest is done with the demo.
    if (pathname === "/login" || pathname === "/register") {
      endDemo();
      window.location.reload();
      return;
    }
    if (!DEMO_PAGES.some((re) => re.test(pathname))) router.replace("/feed");
  }, [pathname, router]);

  useEffect(() => {
    document.documentElement.classList.toggle("demo-active", active);
  }, [active]);

  if (!active) return null;

  const exit = () => {
    endDemo();
    window.location.href = "/login";
  };

  return (
    <div className="demo-banner fixed top-0 left-0 right-0 z-[70] h-8 flex items-center justify-center gap-3 px-3 bg-amber-400 text-black text-xs font-medium">
      <span className="truncate">Guest demo · sample data · nothing is saved</span>
      <button onClick={exit} className="shrink-0 underline underline-offset-2 font-semibold">
        Exit
      </button>
    </div>
  );
}
