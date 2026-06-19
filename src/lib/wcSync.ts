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
