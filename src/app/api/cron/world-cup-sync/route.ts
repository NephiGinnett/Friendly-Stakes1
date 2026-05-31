import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logPoints } from "@/lib/pointLog";

const FD_BASE = "https://api.football-data.org/v4";
const FD_TOKEN = process.env.FOOTBALL_DATA_API_KEY;

async function fdFetch(path: string) {
  if (!FD_TOKEN) throw new Error("FOOTBALL_DATA_API_KEY not configured");
  const res = await fetch(`${FD_BASE}${path}`, {
    headers: { "X-Auth-Token": FD_TOKEN },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  return res.json();
}

// Settle all confidence wager pairs for a finished match.
// Each player backing homeTeam is matched against each player backing awayTeam.
// Asymmetric mechanic (Zoe's rule):
//   Normal (low >= high/2): winner takes both stakes
//   Asymmetric (low < high/2):
//     High-stake player wins → receives both stakes + 33% bonus (from system)
//     Low-stake player wins  → receives both stakes + 33% of high stake (extra penalty from loser)
async function settleMatchConfidenceWagers(matchId: number, winnerTeamId: number | null) {
  const match = await prisma.worldCupMatch.findUnique({ where: { id: matchId } });
  if (!match || match.settled) return 0;

  const homeEntries = await prisma.worldCupEntry.findMany({
    where: { teamId: match.homeTeamId ?? -1 },
    include: { user: true },
  });
  const awayEntries = await prisma.worldCupEntry.findMany({
    where: { teamId: match.awayTeamId ?? -1 },
    include: { user: true },
  });

  let settled = 0;

  for (const home of homeEntries) {
    for (const away of awayEntries) {
      const homeWon = winnerTeamId === match.homeTeamId;
      const awayWon = winnerTeamId === match.awayTeamId;

      // Draw — both get their stakes back, no record created
      if (!homeWon && !awayWon) {
        continue;
      }

      const winner = homeWon ? home : away;
      const loser = homeWon ? away : home;
      const winnerStake = winner.confidenceStake;
      const loserStake = loser.confidenceStake;
      const totalEscrowed = winnerStake + loserStake;
      const high = Math.max(winnerStake, loserStake);
      const low = Math.min(winnerStake, loserStake);
      const isAsymmetric = high > 0 && low < high / 2;
      const bonusAmount = isAsymmetric ? Math.floor(high * 0.33) : 0;
      const highIsWinner = winnerStake >= loserStake;

      // High wins → winner gets pot + 33% bonus from system (e.g. 300+50+99 = 449)
      // Low wins  → winner gets pot - 33% of high stake (e.g. 50+300-99 = 251)
      // The 33% either comes from the system or disappears from the pot respectively
      const winnerPayout = isAsymmetric
        ? highIsWinner
          ? totalEscrowed + bonusAmount
          : totalEscrowed - bonusAmount
        : totalEscrowed;

      await prisma.$transaction(async (tx) => {
        // Deduct stakes from both players
        if (winnerStake > 0) {
          await tx.user.update({ where: { id: winner.userId }, data: { points: { decrement: winnerStake } } });
          await logPoints(tx, winner.userId, -winnerStake, `Confidence wager stake — vs ${loser.user.username}`);
        }
        if (loserStake > 0) {
          await tx.user.update({ where: { id: loser.userId }, data: { points: { decrement: loserStake } } });
          await logPoints(tx, loser.userId, -loserStake, `Confidence wager stake — vs ${winner.user.username}`);
        }
        // Pay out winner
        await tx.user.update({ where: { id: winner.userId }, data: { points: { increment: winnerPayout } } });
        await logPoints(tx, winner.userId, winnerPayout, `Confidence wager won vs ${loser.user.username}${bonusAmount > 0 ? ` (+${bonusAmount} bonus)` : ""}`);
        // Create settlement record
        await tx.confidenceWager.create({
          data: {
            matchId,
            winnerId: winner.userId,
            loserId: loser.userId,
            winnerStake,
            loserStake,
            winnerPayout,
            bonusApplied: isAsymmetric,
            bonusAmount,
          },
        });
      });

      settled++;
    }
  }

  await prisma.worldCupMatch.update({ where: { id: matchId }, data: { settled: true } });

  // Award 3 Monitor Cans to every player backing the winning team
  if (winnerTeamId !== null) {
    const winnerEntries = await prisma.worldCupEntry.findMany({ where: { teamId: winnerTeamId } });
    const teamWins = await prisma.worldCupMatch.count({
      where: {
        status: "FINISHED",
        OR: [
          { homeTeamId: winnerTeamId, winner: "HOME_TEAM" },
          { awayTeamId: winnerTeamId, winner: "AWAY_TEAM" },
        ],
      },
    });
    for (const entry of winnerEntries) {
      await prisma.worldCupEntry.update({
        where: { userId: entry.userId },
        data: { monitorCans: { increment: 3 } },
      });
      // five_match_dynasty: unlock when team hits 5 wins
      if (teamWins >= 5) {
        const achievementExists = await prisma.userAchievement.findUnique({
          where: { userId_achievementId: { userId: entry.userId, achievementId: "five_match_dynasty" } },
        });
        if (!achievementExists) {
          await prisma.userAchievement.create({
            data: { userId: entry.userId, achievementId: "five_match_dynasty" },
          });
        }
      }
    }
  }

  return settled;
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fdFetch("/competitions/WC/matches");
    const matches: {
      id: number; status: string; stage: string; group: string | null;
      utcDate: string;
      homeTeam: { name: string }; awayTeam: { name: string };
      score: { winner: string | null; fullTime: { home: number | null; away: number | null } };
    }[] = data.matches ?? [];

    let upserted = 0;
    let settled = 0;

    for (const m of matches) {
      const homeTeam = await prisma.worldCupTeam.findFirst({
        where: { name: { contains: m.homeTeam.name } },
      });
      const awayTeam = await prisma.worldCupTeam.findFirst({
        where: { name: { contains: m.awayTeam.name } },
      });

      const dbMatch = await prisma.worldCupMatch.upsert({
        where: { fdMatchId: m.id },
        create: {
          fdMatchId: m.id,
          homeTeamId: homeTeam?.id ?? null,
          awayTeamId: awayTeam?.id ?? null,
          homeTeamName: m.homeTeam.name,
          awayTeamName: m.awayTeam.name,
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

      if (m.status === "FINISHED" && !dbMatch.settled) {
        const winnerTeamId = m.score.winner === "HOME_TEAM" ? (homeTeam?.id ?? null)
          : m.score.winner === "AWAY_TEAM" ? (awayTeam?.id ?? null)
          : null;
        const count = await settleMatchConfidenceWagers(dbMatch.id, winnerTeamId);
        settled += count;
      }
    }

    return NextResponse.json({ ok: true, upserted, settled });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
