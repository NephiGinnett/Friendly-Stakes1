// Guest demo: an in-browser stand-in for the real /api routes.
//
// Everything here is pure data manipulation on a plain state object — no
// Prisma, no network. The browser keeps the state in sessionStorage (see
// ./client.ts), so a guest's bets live only in their own tab and vanish when
// they leave. Response shapes mirror the real routes closely enough that the
// real pages render unchanged.

export const GUEST_ID = 9999;
export const GUEST_USERNAME = "guest";
export const GUEST_START_POINTS = 500;

// How long the simulated friends take to react to a guest's moves.
export const AUTO_JOIN_MS = 4_000;
export const AUTO_START_MS = 8_000;
export const AUTO_VOTE_MS = 20_000;

type Side = "for" | "against";

export type DemoUser = { id: number; username: string; points: number };
export type DemoEntry = { id: number; userId: number; side: Side; stake: number; createdAt: string };
export type DemoVote = { id: number; userId: number; choice: Side };
export type DemoWager = {
  id: number;
  title: string;
  description: string | null;
  creatorId: number;
  creatorPosition: string;
  creatorStake: number;
  deadline: string;
  status: "open" | "started" | "voting" | "settled" | "cancelled";
  winnerSide: Side | null;
  settledAt: string | null;
  settledBy: string | null;
  wcBet: boolean;
  createdAt: string;
  entries: DemoEntry[];
  votes: DemoVote[];
  // Simulation timers (ms since epoch). Not part of the real API shape.
  autoJoinAt?: number;
  autoStartAt?: number;
  autoVoteAt?: number;
};
export type DemoPointLog = { id: number; amount: number; reason: string; createdAt: string };
export type DemoState = {
  version: 1;
  nextId: number;
  users: DemoUser[];
  wagers: DemoWager[];
  pointLog: DemoPointLog[];
};

export type DemoResponse = { status: number; body: unknown };

const NOT_IN_DEMO =
  "That part of Friendly Stakes isn't in the guest demo. Bets are the main event, and nothing you do here is saved.";

const SAMPLE_PLAYERS: DemoUser[] = [
  { id: 9001, username: "maple", points: 1840 },
  { id: 9002, username: "dex", points: 1325 },
  { id: 9003, username: "juno", points: 2210 },
  { id: 9004, username: "rory", points: 760 },
  { id: 9005, username: "pip", points: 1090 },
  { id: 9006, username: "sol", points: 1475 },
];
const P = Object.fromEntries(SAMPLE_PLAYERS.map((p) => [p.username, p.id])) as Record<string, number>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function createInitialState(now: number = Date.now()): DemoState {
  const iso = (offset: number) => new Date(now + offset).toISOString();
  let id = 100;
  const entry = (userId: number, side: Side, stake: number, ago: number): DemoEntry => ({
    id: id++, userId, side, stake, createdAt: iso(-ago),
  });
  const vote = (userId: number, choice: Side): DemoVote => ({ id: id++, userId, choice });
  const base = {
    description: null, winnerSide: null, settledAt: null, settledBy: null, wcBet: false,
    entries: [] as DemoEntry[], votes: [] as DemoVote[],
  };

  const wagers: DemoWager[] = [
    {
      ...base, id: 6, status: "open",
      title: "Does Rory finish Saturday's 5K under 40 minutes?",
      description: "Rory has been 'training' for three weeks. Chip time counts.",
      creatorId: P.dex, creatorPosition: "Rory crosses the line under 40:00", creatorStake: 120,
      deadline: iso(3 * DAY), createdAt: iso(-5 * HOUR),
      entries: [entry(P.juno, "for", 50, 4 * HOUR)],
    },
    {
      ...base, id: 5, status: "open",
      title: "Game night food: tacos or pizza?",
      description: "Settled by the group chat poll on Friday.",
      creatorId: P.maple, creatorPosition: "Tacos win the poll", creatorStake: 80,
      deadline: iso(2 * DAY), createdAt: iso(-9 * HOUR),
      entries: [entry(P.pip, "against", 60, 8 * HOUR), entry(P.sol, "for", 40, 7 * HOUR)],
    },
    {
      ...base, id: 4, status: "open",
      title: "First snow before December 1st?",
      creatorId: P.juno, creatorPosition: "It snows (and sticks) before Dec 1", creatorStake: 200,
      deadline: iso(6 * DAY), createdAt: iso(-1 * DAY),
      entries: [entry(P.rory, "against", 150, 20 * HOUR)],
    },
    {
      ...base, id: 3, status: "started",
      title: "Pip beats the final boss on the first try",
      description: "Streamed live, no restarts allowed.",
      creatorId: P.sol, creatorPosition: "First try, no deaths", creatorStake: 100,
      deadline: iso(1 * DAY), createdAt: iso(-2 * DAY),
      entries: [entry(P.dex, "against", 100, 47 * HOUR), entry(P.maple, "for", 50, 46 * HOUR)],
    },
    {
      ...base, id: 2, status: "voting",
      title: "Movie night: the horror pick wins the vote",
      creatorId: P.pip, creatorPosition: "We end up watching the horror movie", creatorStake: 75,
      deadline: iso(-2 * HOUR), createdAt: iso(-3 * DAY),
      entries: [entry(P.rory, "against", 75, 70 * HOUR), entry(P.juno, "for", 30, 60 * HOUR)],
      votes: [vote(P.maple, "for")],
    },
    {
      ...base, id: 1, status: "settled",
      title: "Mario Kart night: who takes the cup?",
      creatorId: P.rory, creatorPosition: "Juno finishes first overall", creatorStake: 150,
      deadline: iso(-4 * DAY), createdAt: iso(-6 * DAY),
      entries: [entry(P.dex, "against", 100, 5 * DAY), entry(P.sol, "against", 60, 5 * DAY)],
      votes: [vote(P.maple, "for"), vote(P.pip, "for")],
      winnerSide: "for", settledAt: iso(-4 * DAY + HOUR), settledBy: "vote",
    },
  ];

  return {
    version: 1,
    nextId: 1000,
    users: [{ id: GUEST_ID, username: GUEST_USERNAME, points: GUEST_START_POINTS }, ...SAMPLE_PLAYERS.map((p) => ({ ...p }))],
    wagers,
    pointLog: [{ id: 1, amount: GUEST_START_POINTS, reason: "Guest demo starting balance", createdAt: iso(0) }],
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

const ok = (body: unknown, status = 200): DemoResponse => ({ status, body });
const err = (error: string, status = 400): DemoResponse => ({ status, body: { error } });

function user(state: DemoState, id: number) {
  return state.users.find((u) => u.id === id);
}
function guest(state: DemoState) {
  return user(state, GUEST_ID)!;
}
function brief(state: DemoState, id: number) {
  const u = user(state, id);
  return { id, username: u?.username ?? "someone" };
}
function newId(state: DemoState) {
  return state.nextId++;
}

function serializeWager(state: DemoState, w: DemoWager) {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    creatorId: w.creatorId,
    creatorPosition: w.creatorPosition,
    creatorStake: w.creatorStake,
    creatorLockedPayout: 0,
    deadline: w.deadline,
    status: w.status,
    winnerSide: w.winnerSide,
    settledAt: w.settledAt,
    settledBy: w.settledBy,
    vpnActive: false,
    vpnMasked: false,
    vpnSeed: 0,
    isPublic: false,
    wcBet: w.wcBet,
    publicFavorForVotes: 0,
    publicFavorForPts: 0,
    publicFavorAgainstVotes: 0,
    publicFavorAgainstPts: 0,
    createdAt: w.createdAt,
    creator: brief(state, w.creatorId),
    entries: w.entries.map((e) => ({
      id: e.id, wagerId: w.id, userId: e.userId, side: e.side, stake: e.stake,
      lockedPayout: 0, createdAt: e.createdAt, user: brief(state, e.userId),
    })),
    votes: w.votes.map((v) => ({
      id: v.id, wagerId: w.id, userId: v.userId, choice: v.choice, weight: 1, user: brief(state, v.userId),
    })),
    botEntries: [],
  };
}

function sortedWagers(state: DemoState) {
  return [...state.wagers].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

function participants(w: DemoWager): { userId: number; side: Side; stake: number }[] {
  return [{ userId: w.creatorId, side: "for", stake: w.creatorStake }, ...w.entries];
}

function settle(state: DemoState, w: DemoWager, winnerSide: Side, now: number) {
  const all = participants(w);
  const pool = all.reduce((s, p) => s + p.stake, 0);
  const winners = all.filter((p) => p.side === winnerSide);
  w.status = "settled";
  w.winnerSide = winnerSide;
  w.settledAt = new Date(now).toISOString();
  w.settledBy = "vote";
  w.autoJoinAt = w.autoStartAt = w.autoVoteAt = undefined;
  if (winners.length === 0) return;
  // Same proportional split as the real settle (src/lib/settle.ts).
  const winnerStake = winners.reduce((s, p) => s + p.stake, 0);
  const payouts = winners.map((p) => ({ userId: p.userId, amount: Math.floor((p.stake / winnerStake) * pool) }));
  payouts[0].amount += pool - payouts.reduce((s, p) => s + p.amount, 0);
  for (const p of payouts) {
    const u = user(state, p.userId);
    if (u) u.points += p.amount;
    if (p.userId === GUEST_ID) {
      state.pointLog.unshift({ id: newId(state), amount: p.amount, reason: `Won wager: ${w.title}`, createdAt: new Date(now).toISOString() });
    }
  }
}

function maybeSettleFromVotes(state: DemoState, w: DemoWager, now: number) {
  const f = w.votes.filter((v) => v.choice === "for").length;
  const a = w.votes.filter((v) => v.choice === "against").length;
  if (f >= 2 && f > a) settle(state, w, "for", now);
  else if (a >= 2 && a > f) settle(state, w, "against", now);
}

// Advance the pretend friends: they join a guest's new bet, start bets the
// guest joined, and call the result once the "event" is over.
export function tick(state: DemoState, now: number, rand: () => number = Math.random) {
  for (const w of state.wagers) {
    if (w.autoJoinAt && now >= w.autoJoinAt && w.status === "open") {
      w.autoJoinAt = undefined;
      const taken = new Set(participants(w).map((p) => p.userId));
      const pool = SAMPLE_PLAYERS.filter((p) => !taken.has(p.id));
      const joiners = Math.min(pool.length, 1 + Math.floor(rand() * 2));
      for (let i = 0; i < joiners; i++) {
        const pick = pool.splice(Math.floor(rand() * pool.length), 1)[0];
        const stake = Math.max(10, Math.round((w.creatorStake * (0.4 + rand() * 0.6)) / 5) * 5);
        const side: Side = i === 0 ? "against" : rand() < 0.5 ? "for" : "against";
        const u = user(state, pick.id)!;
        u.points -= stake;
        w.entries.push({ id: newId(state), userId: pick.id, side, stake, createdAt: new Date(now).toISOString() });
      }
    }
    if (w.autoStartAt && now >= w.autoStartAt && w.status === "open") {
      w.autoStartAt = undefined;
      if (w.entries.some((e) => e.side === "against")) {
        w.status = "started";
        w.autoVoteAt = now + AUTO_VOTE_MS;
      }
    }
    if (w.autoVoteAt && now >= w.autoVoteAt && w.status === "started") {
      w.autoVoteAt = undefined;
      w.status = "voting";
    }
  }
}

function readBody(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

// ── router ───────────────────────────────────────────────────────────────────

export function handleDemoApi(
  state: DemoState,
  method: string,
  pathAndQuery: string,
  rawBody: unknown,
  now: number = Date.now(),
  rand: () => number = Math.random,
): DemoResponse {
  tick(state, now, rand);
  const url = new URL(pathAndQuery, "http://demo.local");
  const path = url.pathname.replace(/\/+$/, "");
  const m = method.toUpperCase();
  const body = readBody(rawBody);
  const me = guest(state);

  // Auth
  if (path === "/api/auth/me" && m === "GET") {
    return ok({
      id: me.id, username: me.username, points: me.points, isAdmin: false,
      avatarAchievementId: null, siteTheme: "", ownedThemes: "[]", isDemo: true,
    });
  }
  if (path === "/api/auth/logout") return ok({ ok: true });
  if (path === "/api/auth/verify-pin") return ok({ valid: true });

  // Wagers
  if (path === "/api/wagers" && m === "GET") {
    const status = url.searchParams.get("status");
    const tag = url.searchParams.get("tag");
    return ok(
      sortedWagers(state)
        .filter((w) => (!status || w.status === status) && (tag !== "world-cup" || w.wcBet))
        .map((w) => serializeWager(state, w)),
    );
  }
  if (path === "/api/wagers" && m === "POST") {
    const title = String(body.title ?? "").trim();
    const creatorPosition = String(body.creatorPosition ?? "").trim();
    const creatorStake = Number(body.creatorStake);
    const deadline = String(body.deadline ?? "");
    if (!title || !creatorPosition || !creatorStake || !deadline) return err("Missing required fields");
    if (!Number.isInteger(creatorStake) || creatorStake < 1) return err("Stake must be at least 1 point");
    if (creatorStake > me.points) return err("Not enough points");
    const d = new Date(deadline);
    if (isNaN(d.getTime()) || d.getTime() <= now) return err("Deadline must be in the future");
    const w: DemoWager = {
      id: newId(state), title, description: body.description ? String(body.description) : null,
      creatorId: GUEST_ID, creatorPosition, creatorStake, deadline: d.toISOString(), status: "open",
      winnerSide: null, settledAt: null, settledBy: null, wcBet: false,
      createdAt: new Date(now).toISOString(), entries: [], votes: [],
      autoJoinAt: now + AUTO_JOIN_MS,
    };
    me.points -= creatorStake;
    state.wagers.push(w);
    return ok(serializeWager(state, w), 201);
  }

  const wm = path.match(/^\/api\/wagers\/(\d+)(?:\/([a-z-]+))?$/);
  if (wm) {
    const w = state.wagers.find((x) => x.id === Number(wm[1]));
    if (!w) return err("Wager not found", 404);
    const action = wm[2];

    if (!action && m === "GET") return ok(serializeWager(state, w));

    if (action === "join" && m === "POST") {
      const side = body.side;
      const stake = Number(body.stake);
      if (side !== "for" && side !== "against") return err("Side must be 'for' or 'against'");
      if (!Number.isInteger(stake) || stake < 1) return err("Stake must be at least 1 point");
      if (stake > me.points) return err("Not enough points");
      if (w.status !== "open") return err("This wager is no longer open to join");
      if (new Date(w.deadline).getTime() < now) return err("This wager's deadline has passed");
      if (w.creatorId === GUEST_ID) return err("You created this wager — you're already on the 'for' side");
      if (w.entries.some((e) => e.userId === GUEST_ID)) return err("You've already joined this wager", 409);
      me.points -= stake;
      w.entries.push({ id: newId(state), userId: GUEST_ID, side, stake, createdAt: new Date(now).toISOString() });
      // The (pretend) creator locks it in shortly after a guest joins.
      if (w.entries.some((e) => e.side === "against")) w.autoStartAt = now + AUTO_START_MS;
      return ok({ ok: true });
    }

    if (action === "start" && m === "POST") {
      if (w.creatorId !== GUEST_ID) return err("Only the creator can start this wager", 403);
      if (w.status !== "open") return err("Wager is not open");
      if (!w.entries.some((e) => e.side === "against")) return err("Need at least one person on the 'against' side");
      w.status = "started";
      w.autoStartAt = undefined;
      w.autoVoteAt = now + AUTO_VOTE_MS;
      return ok({ ok: true });
    }

    if (action === "close-early" && m === "POST") {
      if (w.status !== "started") return err("Wager is not in progress");
      w.status = "voting";
      w.autoVoteAt = undefined;
      return ok({ ok: true });
    }

    if (action === "vote" && m === "POST") {
      const choice = body.choice;
      if (choice !== "for" && choice !== "against") return err("Choice must be 'for' or 'against'");
      if (w.status !== "voting") return err("Wager is not open for voting");
      const mine = w.votes.find((v) => v.userId === GUEST_ID);
      if (mine) mine.choice = choice;
      else w.votes.push({ id: newId(state), userId: GUEST_ID, choice });
      maybeSettleFromVotes(state, w, now);
      // A friend weighs in after the guest so the bet can actually resolve.
      if (w.status === "voting") {
        const voted = new Set(w.votes.map((v) => v.userId));
        const sameSide = participants(w).filter((p) => p.side === choice && p.userId !== GUEST_ID && !voted.has(p.userId));
        const anyone = SAMPLE_PLAYERS.filter((p) => !voted.has(p.id));
        const voter = sameSide[0]?.userId ?? anyone[0]?.id;
        if (voter) w.votes.push({ id: newId(state), userId: voter, choice });
        maybeSettleFromVotes(state, w, now);
      }
      return ok({ ok: true });
    }

    return err(NOT_IN_DEMO, 403);
  }

  // Players & profile
  if (path === "/api/users" && m === "GET") {
    return ok([...state.users].sort((a, b) => b.points - a.points).map((u) => ({ id: u.id, username: u.username, points: u.points })));
  }
  const pm = path.match(/^\/api\/players\/([^/]+)$/);
  if (pm && m === "GET") {
    const name = decodeURIComponent(pm[1]).toLowerCase();
    const p = state.users.find((u) => u.username === name);
    if (!p) return err("Not found", 404);
    const wagers = sortedWagers(state)
      .filter((w) => w.creatorId === p.id || w.entries.some((e) => e.userId === p.id))
      .map((w) => serializeWager(state, w));
    return ok({ player: { id: p.id, username: p.username, points: p.points, isAdmin: false, avatarAchievementId: null }, wagers, achievements: [] });
  }
  if (path === "/api/point-log" && m === "GET") return ok(state.pointLog.slice(0, 50));
  if (path === "/api/achievements" && m === "GET") return ok([]);
  if (path === "/api/settings/discord" && m === "GET") return ok({ discordUserId: null });

  // Things the shared chrome (navbar, feed banners) asks for on every page.
  if (path === "/api/shop" && m === "GET") {
    return ok({ items: [], owned: [], earlybird: { purchased: 0, remaining: 0, nextTier: null, userClaimed: 0 }, hasWatchedAd: false, syscoSubscriber: false });
  }
  if (path === "/api/notifications" && m === "GET") {
    const unvoted = state.wagers.filter((w) => w.status === "voting" && participants(w).some((p) => p.userId === GUEST_ID) && !w.votes.some((v) => v.userId === GUEST_ID)).length;
    return ok({ challenges: 0, wagers: unvoted, achievements: 0, adminBingo: 0, bingo: null, boss: false, distributions: 0 });
  }
  if (path === "/api/house" && m === "GET") {
    return ok({
      phase: 0, bossActive: false, casinoOpen: false, casinoNightActive: false, casinoNightOpen: false,
      bossFightLive: false, worldCupAdminAt: null, worldCupPlayerAt: null, worldCupEventEndAt: null,
    });
  }
  if (path === "/api/distribution/pending" && m === "GET") return ok([]);
  if (path === "/api/discovery/pages") return ok({ visited: [] });
  if (path === "/api/world-cup/teaser") return err("Not available in the demo", 404);

  return err(NOT_IN_DEMO, 403);
}
