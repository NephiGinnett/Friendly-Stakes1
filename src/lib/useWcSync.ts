import { useEffect, useRef } from "react";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useWcSync() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    fetch("/api/world-cup/sync", { method: "POST" }).catch(() => {});

    const id = setInterval(() => {
      fetch("/api/world-cup/sync", { method: "POST" }).catch(() => {});
    }, POLL_INTERVAL);

    return () => clearInterval(id);
  }, []);
}
