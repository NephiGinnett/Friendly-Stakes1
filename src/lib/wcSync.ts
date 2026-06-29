import { prisma } from "@/lib/db";

const FD_BASE = "https://api.football-data.org/v4";

type FdMatch = {
  id: number; status: string; stage: string; group: string | null;
  utcDate: string;
  homeTeam: { name: string; shortName?: string };
  awayTeam: { name: string; shortName?: string };
  score: { winner: string | null; fullTime: { home: number | null; away: number | null } };
};

export async function fetchFdMatches(token: string): Promise<FdMatch[]> {
  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.matches ?? [];
}

const STAGE_TO_ROUND: Record<string, string> = {
  ROUND_OF_32: "R32",
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
    const homeTeam = m.homeTeam?.name ? await prisma.worldCupTeam.findFirst({
      where: { OR: [{ name: { contains: m.homeTeam.name } }, ...(m.homeTeam.shortName ? [{ name: { contains: m.homeTeam.shortName } }] : [])] },
    }) : null;
    const awayTeam = m.awayTeam?.name ? await prisma.worldCupTeam.findFirst({
      where: { OR: [{ name: { contains: m.awayTeam.name } }, ...(m.awayTeam.shortName ? [{ name: { contains: m.awayTeam.shortName } }] : [])] },
    }) : null;
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

      const homeTeam = m.homeTeam?.name ? await prisma.worldCupTeam.findFirst({
        where: { OR: [{ name: { contains: m.homeTeam.name } }, ...(m.homeTeam.shortName ? [{ name: { contains: m.homeTeam.shortName } }] : [])] },
      }) : null;
      const awayTeam = m.awayTeam?.name ? await prisma.worldCupTeam.findFirst({
        where: { OR: [{ name: { contains: m.awayTeam.name } }, ...(m.awayTeam.shortName ? [{ name: { contains: m.awayTeam.shortName } }] : [])] },
      }) : null;

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
