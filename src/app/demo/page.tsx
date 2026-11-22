"use client";

import { useEffect } from "react";
import { startDemo } from "@/lib/demo/client";

// Public guest entry point: no login or invite. Starts a fresh in-browser demo
// (500 sample points, sample bets and players) and drops the guest on the feed.
export default function DemoPage() {
  useEffect(() => {
    startDemo();
    // Full navigation so every component mounts with the demo already active.
    window.location.replace("/feed");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-slate-400 text-sm">
      Setting up your guest table…
    </div>
  );
}
