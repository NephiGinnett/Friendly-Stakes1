"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error so it shows up in the browser console / logs
    // instead of only the generic "a client-side exception has occurred".
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-4xl">🎲</div>
      <h1 className="text-lg font-bold text-white">Something glitched.</h1>
      <p className="text-sm text-slate-400 max-w-sm">
        This page hit an error. It&rsquo;s been logged — try again, and if it keeps
        happening let the admin know.
      </p>
      {error?.message && (
        <p className="text-xs font-mono text-rose-400/80 max-w-sm break-words">
          {error.message}
        </p>
      )}
      <div className="flex gap-3 pt-1">
        <button
          onClick={reset}
          className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 text-sm font-semibold transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 px-4 py-2 text-sm font-semibold transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
