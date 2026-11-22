// Guest demo tests. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_JOIN_MS, AUTO_START_MS, AUTO_VOTE_MS, GUEST_ID, GUEST_START_POINTS,
  createInitialState, handleDemoApi, type DemoState,
} from "./mockApi";
import { endDemo, isApiUrl, makeDemoFetch, startDemo } from "./client";

const T0 = Date.parse("2026-11-22T12:00:00Z");
const rand = () => 0.3;

function call(state: DemoState, method: string, path: string, body?: unknown, now = T0) {
  return handleDemoApi(state, method, path, body ?? null, now, rand);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

test("guest starts with 500 points and only sample data", () => {
  const s = createInitialState(T0);
  const me = call(s, "GET", "/api/auth/me").body as Any;
  assert.equal(me.id, GUEST_ID);
  assert.equal(me.points, GUEST_START_POINTS);
  assert.equal(me.isAdmin, false);

  const wagers = call(s, "GET", "/api/wagers").body as Any[];
  assert.ok(wagers.length >= 5);
  const statuses = new Set(wagers.map((w) => w.status));
  for (const st of ["open", "started", "voting", "settled"]) assert.ok(statuses.has(st), `has a ${st} sample bet`);
  const open = call(s, "GET", "/api/wagers?status=open").body as Any[];
  assert.ok(open.every((w) => w.status === "open"));

  const users = call(s, "GET", "/api/users").body as Any[];
  assert.deepEqual(users.map((u) => u.username).sort(), ["dex", "guest", "juno", "maple", "pip", "rory", "sol"]);
});

test("guest creates a bet, friends join, it plays out and pays the winner", () => {
  const s = createInitialState(T0);
  const res = call(s, "POST", "/api/wagers", {
    title: "Test bet", creatorPosition: "I win", creatorStake: 100,
    deadline: new Date(T0 + 86_400_000).toISOString(),
  });
  assert.equal(res.status, 201);
  const id = (res.body as Any).id;
  assert.equal((call(s, "GET", "/api/auth/me").body as Any).points, 400);

  let w = call(s, "GET", `/api/wagers/${id}`).body as Any;
  assert.equal(w.entries.length, 0);

  const t1 = T0 + AUTO_JOIN_MS + 1;
  w = call(s, "GET", `/api/wagers/${id}`, null, t1).body as Any;
  assert.ok(w.entries.some((e: Any) => e.side === "against"), "a sample friend took the other side");

  assert.equal(call(s, "POST", `/api/wagers/${id}/start`, null, t1).status, 200);
  assert.equal(call(s, "POST", `/api/wagers/${id}/close-early`, null, t1).status, 200);
  assert.equal((call(s, "GET", `/api/wagers/${id}`, null, t1).body as Any).status, "voting");

  const pool = 100 + w.entries.reduce((sum: number, e: Any) => sum + e.stake, 0);
  const forStake = 100 + w.entries.filter((e: Any) => e.side === "for").reduce((sum: number, e: Any) => sum + e.stake, 0);
  call(s, "POST", `/api/wagers/${id}/vote`, { choice: "for" }, t1);
  w = call(s, "GET", `/api/wagers/${id}`, null, t1).body as Any;
  assert.equal(w.status, "settled");
  assert.equal(w.winnerSide, "for");
  // With the fixed rand, one friend joins "against", so the guest is the only
  // winner and takes the whole pool.
  assert.equal(forStake, 100);
  assert.equal((call(s, "GET", "/api/auth/me", null, t1).body as Any).points, 400 + pool);
  const log = call(s, "GET", "/api/point-log", null, t1).body as Any[];
  assert.match(log[0].reason, /Won wager: Test bet/);
});

test("guest joins a sample bet and the creator starts it, then voting opens", () => {
  const s = createInitialState(T0);
  const open = (call(s, "GET", "/api/wagers?status=open").body as Any[]).find((w) => w.creator.id !== GUEST_ID)!;
  assert.equal(call(s, "POST", `/api/wagers/${open.id}/join`, { side: "against", stake: 50 }).status, 200);
  assert.equal((call(s, "GET", "/api/auth/me").body as Any).points, 450);
  assert.equal(call(s, "POST", `/api/wagers/${open.id}/join`, { side: "for", stake: 5 }).status, 409);

  const t1 = T0 + AUTO_START_MS + 1;
  assert.equal((call(s, "GET", `/api/wagers/${open.id}`, null, t1).body as Any).status, "started");
  const t2 = t1 + AUTO_VOTE_MS + 1;
  assert.equal((call(s, "GET", `/api/wagers/${open.id}`, null, t2).body as Any).status, "voting");

  call(s, "POST", `/api/wagers/${open.id}/vote`, { choice: "against" }, t2);
  const w = call(s, "GET", `/api/wagers/${open.id}`, null, t2).body as Any;
  assert.equal(w.status, "settled");
  assert.equal(w.winnerSide, "against");
});

test("validation mirrors the real routes", () => {
  const s = createInitialState(T0);
  const future = new Date(T0 + 86_400_000).toISOString();
  assert.equal(call(s, "POST", "/api/wagers", { title: "x", creatorPosition: "y", creatorStake: 501, deadline: future }).status, 400);
  assert.equal(call(s, "POST", "/api/wagers", { title: "x", creatorPosition: "y", creatorStake: 5, deadline: new Date(T0 - 1).toISOString() }).status, 400);
  assert.equal(call(s, "POST", "/api/wagers/999/join", { side: "for", stake: 5 }).status, 404);
  const started = (call(s, "GET", "/api/wagers?status=started").body as Any[])[0];
  assert.equal(call(s, "POST", `/api/wagers/${started.id}/join`, { side: "for", stake: 5 }).status, 400);
  // Guests can't use admin settle.
  assert.equal(call(s, "POST", `/api/wagers/${started.id}/settle`, { winnerSide: "for" }).status, 403);
});

test("everything outside betting is refused, never faked as a success", () => {
  const s = createInitialState(T0);
  for (const [m, p] of [
    ["GET", "/api/admin/users"], ["POST", "/api/admin/users/1/points"], ["POST", "/api/shop/buy"],
    ["POST", "/api/achievements/claim"], ["POST", "/api/auth/register"], ["POST", "/api/auth/login"],
    ["POST", "/api/settings/theme"], ["POST", "/api/settings/discord"], ["GET", "/api/cron/close-bets"],
  ]) {
    assert.equal(call(s, m, p).status, 403, `${m} ${p}`);
  }
});

// ── the browser fetch patch ─────────────────────────────────────────────────

test("isApiUrl only matches this site's /api paths", () => {
  const o = "https://fs.example";
  assert.ok(isApiUrl("/api/wagers", o));
  assert.ok(isApiUrl("https://fs.example/api/wagers/1/join", o));
  assert.ok(!isApiUrl("/apiary", o));
  assert.ok(!isApiUrl("/feed?_rsc=1", o));
  assert.ok(!isApiUrl("https://other.example/api/x", o));
});

test("in demo mode no /api request ever reaches the server", async () => {
  const sent: string[] = [];
  const realFetch = (async (input: RequestInfo | URL) => {
    sent.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const origin = "https://fs.example";

  startDemo();
  try {
    const f = makeDemoFetch(realFetch, origin);
    const me = await (await f("/api/auth/me")).json();
    assert.equal(me.id, GUEST_ID);
    const wagers = await (await f(`${origin}/api/wagers?status=open`)).json();
    const target = wagers[0];
    const join = await f(`/api/wagers/${target.id}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: "against", stake: 25 }),
    });
    assert.equal(join.status, 200);
    // Request objects too.
    const req = new Request(`${origin}/api/wagers`, {
      method: "POST", body: JSON.stringify({ title: "t", creatorPosition: "p", creatorStake: 10, deadline: new Date(Date.now() + 864e5).toISOString() }),
    });
    assert.equal((await f(req)).status, 201);
    assert.equal((await f("/api/admin/backup", { method: "POST" })).status, 403);
    assert.equal((await (await f("/api/auth/me")).json()).points, 500 - 25 - 10);
    assert.deepEqual(sent, [], "real fetch was never called for /api");

    await f("/feed?_rsc=abc");
    assert.deepEqual(sent, ["/feed?_rsc=abc"], "non-API requests pass through");
  } finally {
    endDemo();
  }

  // Demo over: API calls go to the real server again (members unaffected).
  const f2 = makeDemoFetch(realFetch, origin);
  await f2("/api/auth/me");
  assert.equal(sent.at(-1), "/api/auth/me");
});
