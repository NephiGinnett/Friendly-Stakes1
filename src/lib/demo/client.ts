// Browser side of the guest demo.
//
// While a demo is active, every same-origin /api/* fetch is answered in the
// browser by handleDemoApi() — the request never leaves the tab, so a guest
// can't read real members' data or write anything to the database. State
// lives in sessionStorage: it survives page navigation within the tab and is
// gone when the tab closes or the guest exits the demo.

import { createInitialState, handleDemoApi, type DemoState } from "./mockApi";

const STATE_KEY = "fs_demo_state_v1";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

// Fallback when sessionStorage is unavailable (private mode etc.): the demo
// still works, it just resets on a full page reload.
let memoryState: DemoState | null = null;

export function isDemoActive(): boolean {
  if (memoryState) return true;
  try {
    return !!storage()?.getItem(STATE_KEY);
  } catch {
    return false;
  }
}

export function loadDemoState(): DemoState | null {
  try {
    const raw = storage()?.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch { /* fall through */ }
  return memoryState;
}

function saveDemoState(state: DemoState) {
  memoryState = state;
  try {
    storage()?.setItem(STATE_KEY, JSON.stringify(state));
  } catch { /* memory copy is enough */ }
}

export function startDemo() {
  saveDemoState(createInitialState());
  installDemoFetch();
}

export function endDemo() {
  memoryState = null;
  try {
    storage()?.removeItem(STATE_KEY);
  } catch { /* ignore */ }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  let text: string | null = null;
  if (init?.body != null) text = typeof init.body === "string" ? init.body : null;
  else if (typeof Request !== "undefined" && input instanceof Request) text = await input.clone().text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Exported for tests: decide whether a URL belongs to the app's API.
export function isApiUrl(url: string, origin: string): boolean {
  try {
    const u = new URL(url, origin);
    return u.origin === origin && (u.pathname === "/api" || u.pathname.startsWith("/api/"));
  } catch {
    return false;
  }
}

// Build the fetch replacement. Split out from installDemoFetch so tests can
// run it against a stub "real" fetch.
export function makeDemoFetch(realFetch: typeof fetch, origin: string, active: () => boolean = isDemoActive): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!active() || !isApiUrl(url, origin)) return realFetch(input, init);

    const method = init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET");
    const body = await requestBody(input, init);
    const state = loadDemoState() ?? createInitialState();
    const u = new URL(url, origin);
    const res = handleDemoApi(state, method, u.pathname + u.search, body);
    saveDemoState(state);
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: { "Content-Type": "application/json", "X-Friendly-Stakes-Demo": "1" },
    });
  };
}

let installed = false;

export function installDemoFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = makeDemoFetch(realFetch, window.location.origin);
}

// Installing as soon as this module loads (before any component's effects
// run) means even the very first /api call on a page is intercepted. Once
// installed, the patch is inert unless a demo is active.
if (typeof window !== "undefined" && isDemoActive()) installDemoFetch();
