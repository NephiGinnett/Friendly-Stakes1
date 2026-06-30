import { prisma } from "@/lib/db";

const FD_BASE = "https://api.football-data.org/v4";

export type FdTeam = { name?: string | null; shortName?: string | null; tla?: string | null };

type FdMatch = {
  id: number; status: string; stage: string; group: string | null;
  utcDate: string;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: { winner: string | null; fullTime: { home: number | null; away: number | null } };
};

// Resolve a football-data team to a WorldCupTeam row. Match on the 3-letter
// code (tla) first — far more reliable than names, which football-data spells
// differently than our DB ("Korea Republic" vs "South Korea", "IR Iran" vs
// "Iran", etc.) — then fall back to a fuzzy name match.
export async function findWcTeam(team: FdTeam | null | undefined) {
  if (!team) return null;
  if (team.tla) {
    const byCode = await prisma.worldCupTeam.findFirst({ where: { code: team.tla.toUpperCase() } });
    if (byCode) return byCode;
  }
  if (team.name) {
    return prisma.worldCupTeam.findFirst({
      where: { OR: [{ name: { contains: team.name } }, ...(team.shortName ? [{ name: { contains: team.shortName } }] : [])] },
    });
  }
  return null;
}

export async function fetchFdMatches(token: string): Promise<FdMatch[]> {
  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.matches ?? [];
}

// football-data.org v4 labels the first two knockout rounds LAST_32 / LAST_16;
// older/alternate feeds use ROUND_OF_32 / ROUND_OF_16. Accept both so bracket
// slots seed regardless of which the API returns.
export const STAGE_TO_ROUND: Record<string, string> = {
  LAST_32: "R32",
  ROUND_OF_32: "R32",
  LAST_16: "R16",
  ROUND_OF_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  FINAL: "FINAL",
};

const ROUND_CANS: Record<string, number> = {
  R32: 5, R16: 10, QF: 20, SF: 40, FINAL: 80,
};

// Seed the BracketSlot table (the "MATCH SLOTS" admin grid) from football-data
// knockout fixtures, and award Monitor Cans to players who predicted a finished
// match correctly. Shared by both the cron route and the manual "Sync Matches"
// admin action so the two paths can never drift apart again.
export async function seedBracketSlots(matches: FdMatch[]): Promise<number> {
  const knockoutRows: {
    fdMatchId: number; stage: string; kickoff: Date;
    homeCode: string; awayCode: string; winnerCode: string;
  }[] = [];

  for (const m of matches) {
    if (!STAGE_TO_ROUND[m.stage]) continue;
    const homeTeam = await findWcTeam(m.homeTeam);
    const awayTeam = await findWcTeam(m.awayTeam);
    knockoutRows.push({
      fdMatchId: m.id,
      stage: m.stage,
      kickoff: new Date(m.utcDate),
      homeCode: homeTeam?.code ?? "",
      awayCode: awayTeam?.code ?? "",
      winnerCode: m.score.winner === "HOME_TEAM" ? (homeTeam?.code ?? "")
        : m.score.winner === "AWAY_TEAM" ? (awayTeam?.code ?? "")
        : "",
    });
  }

  let bracketSlots = 0;
  const byStage = new Map<string, typeof knockoutRows>();
  for (const row of knockoutRows) {
    if (!byStage.has(row.stage)) byStage.set(row.stage, []);
    byStage.get(row.stage)!.push(row);
  }

  for (const stage of Array.from(byStage.keys())) {
    const rows = byStage.get(stage)!;
    const round = STAGE_TO_ROUND[stage];
    rows.sort((a, b) => a.fdMatchId - b.fdMatchId);
    for (let pos = 0; pos < rows.length; pos++) {
      const r = rows[pos];
      await prisma.bracketSlot.upsert({
        where: { round_position: { round, position: pos } },
        create: { round, position: pos, team1Code: r.homeCode, team2Code: r.awayCode, winnerCode: r.winnerCode, fdMatchId: r.fdMatchId },
        update: { team1Code: r.homeCode, team2Code: r.awayCode, winnerCode: r.winnerCode, fdMatchId: r.fdMatchId },
      });
      bracketSlots++;

      // Award monitor cans to players who correctly predicted this match
      if (r.winnerCode) {
        const correctPicks = await prisma.bracketPick.findMany({
          where: { round, position: pos, teamCode: r.winnerCode, cansAwarded: false },
        });
        for (const pick of correctPicks) {
          await prisma.worldCupEntry.updateMany({
            where: { userId: pick.userId },
            data: { monitorCans: { increment: ROUND_CANS[round] ?? 0 } },
          });
          await prisma.bracketPick.update({
            where: { id: pick.id },
            data: { cansAwarded: true },
          });
        }
      }
    }
  }

  return bracketSlots;
}

export async function upsertMatches(matches: FdMatch[]): Promise<{ upserted: number; errors: string[] }> {
  let upserted = 0;
  const errors: string[] = [];

  for (const m of matches) {
    try {
      // Skip matches where teams aren't determined yet (knockout TBD)
      if (!m.homeTeam?.name && !m.awayTeam?.name) continue;

      const homeTeam = await findWcTeam(m.homeTeam);
      const awayTeam = await findWcTeam(m.awayTeam);

      await prisma.worldCupMatch.upsert({
        where: { fdMatchId: m.id },
        create: {
          fdMatchId: m.id,
          homeTeamId: homeTeam?.id ?? null,
          awayTeamId: awayTeam?.id ?? null,
          homeTeamName: m.homeTeam?.name ?? "TBD",
          awayTeamName: m.awayTeam?.name ?? "TBD",
          kickoff: new Date(m.utcDate),
          stage: m.stage,
          group: m.group ?? null,
          homeScore: m.score.fullTime.home ?? null,
          awayScore: m.score.fullTime.away ?? null,
          status: m.status,
          winner: m.score.winner ?? null,
        },
        update: {
          homeTeamId: homeTeam?.id ?? null,
          awayTeamId: awayTeam?.id ?? null,
          homeScore: m.score.fullTime.home ?? null,
          awayScore: m.score.fullTime.away ?? null,
          status: m.status,
          winner: m.score.winner ?? null,
          group: m.group ?? null,
          stage: m.stage,
        },
      });
      upserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`match ${m.id} (${m.homeTeam.name} vs ${m.awayTeam.name}): ${msg}`);
    }
  }

  return { upserted, errors };
}
