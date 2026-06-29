import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logPoints } from "@/lib/pointLog";
import { seedBracketSlots, findWcTeam, STAGE_TO_ROUND, type FdTeam } from "@/lib/wcSync";

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

  // Gather entries: primary team backers + proxy team backers
  const homePrimary = await prisma.worldCupEntry.findMany({
    where: { teamId: match.homeTeamId ?? -1 },
    include: { user: true },
  });
  const homeProxy = await prisma.worldCupEntry.findMany({
    where: { proxyTeamId: match.homeTeamId ?? -1, teamId: { not: match.homeTeamId ?? -1 } },
    include: { user: true },
  });
  const awayPrimary = await prisma.worldCupEntry.findMany({
    where: { teamId: match.awayTeamId ?? -1 },
    include: { user: true },
  });
  const awayProxy = await prisma.worldCupEntry.findMany({
    where: { proxyTeamId: match.awayTeamId ?? -1, teamId: { not: match.awayTeamId ?? -1 } },
    include: { user: true },
  });

  type EntryWithStake = typeof homePrimary[number] & { effectiveStake: number; isBot?: boolean };
  const homeEntries: EntryWithStake[] = [
    ...homePrimary.map((e) => ({ ...e, effectiveStake: e.confidenceStake })),
    ...homeProxy.map((e) => ({ ...e, effectiveStake: e.proxyConfidenceStake })),
  ];
  const awayEntries: EntryWithStake[] = [
    ...awayPrimary.map((e) => ({ ...e, effectiveStake: e.confidenceStake })),
    ...awayProxy.map((e) => ({ ...e, effectiveStake: e.proxyConfidenceStake })),
  ];

  // Bot backfill: if one side has no backers, inject a phantom 100-pt bot entry
  // so the other side's players still earn from confidence wagers
  const BOT_STAKE = 100;
  if (homeEntries.length === 0 && awayEntries.length > 0) {
    homeEntries.push({ userId: -1, isBot: true, effectiveStake: BOT_STAKE, user: { username: "Auto-Opponent" } } as unknown as EntryWithStake);
  } else if (awayEntries.length === 0 && homeEntries.length > 0) {
    awayEntries.push({ userId: -1, isBot: true, effectiveStake: BOT_STAKE, user: { username: "Auto-Opponent" } } as unknown as EntryWithStake);
  }

  let settled = 0;

  for (const home of homeEntries) {
    for (const away of awayEntries) {
      if (home.userId === away.userId) continue;

      const homeWon = winnerTeamId === match.homeTeamId;
      const awayWon = winnerTeamId === match.awayTeamId;

      if (!homeWon && !awayWon) {
        continue;
      }

      const winner = homeWon ? home : away;
      const loser = homeWon ? away : home;
      const winnerStake = winner.effectiveStake;
      const loserStake = loser.effectiveStake;
      const totalEscrowed = winnerStake + loserStake;
      const high = Math.max(winnerStake, loserStake);
      const low = Math.min(winnerStake, loserStake);
      const isAsymmetric = high > 0 && low < high / 2;
      const bonusAmount = isAsymmetric ? Math.floor(high * 0.33) : 0;
      const highIsWinner = winnerStake >= loserStake;

      const winnerPayout = isAsymmetric
        ? highIsWinner
          ? totalEscrowed + bonusAmount
          : totalEscrowed - bonusAmount
        : totalEscrowed;

      const netProfit = Math.max(0, winnerPayout - winnerStake);
      const fanSkim = Math.floor(netProfit * 0.10);
      const effectivePayout = winnerPayout - fanSkim;

      const winnerIsBot = !!(winner as EntryWithStake).isBot;
      const loserIsBot = !!(loser as EntryWithStake).isBot;

      // Bot lost — real player wins system-funded points; bot won — player loses stake
      await prisma.$transaction(async (tx) => {
        // Deduct stakes from real players only
        if (winnerStake > 0 && !winnerIsBot) {
          await tx.user.update({ where: { id: winner.userId }, data: { points: { decrement: winnerStake } } });
          await logPoints(tx, winner.userId, -winnerStake, `Confidence wager stake — vs ${loser.user.username}`);
        }
        if (loserStake > 0 && !loserIsBot) {
          await tx.user.update({ where: { id: loser.userId }, data: { points: { decrement: loserStake } } });
          await logPoints(tx, loser.userId, -loserStake, `Confidence wager stake — vs ${winner.user.username}`);
        }
        // Pay out winner (skip if bot won)
        if (!winnerIsBot) {
          await tx.user.update({ where: { id: winner.userId }, data: { points: { increment: effectivePayout } } });
          await logPoints(tx, winner.userId, effectivePayout, `Confidence wager won vs ${loser.user.username}${bonusAmount > 0 ? ` (+${bonusAmount} bonus)` : ""}${fanSkim > 0 ? ` (−${fanSkim} fan pot)` : ""}`);
        }
        // Create settlement record (only for real winners)
        if (!winnerIsBot && !loserIsBot) {
          await tx.confidenceWager.create({
            data: {
              matchId,
              winnerId: winner.userId,
              loserId: loser.userId,
              winnerStake,
              loserStake,
              winnerPayout: effectivePayout,
              bonusApplied: isAsymmetric,
              bonusAmount,
            },
          });
        } else if (!winnerIsBot) {
          // Bot opponent — record with winnerId only, loserId = winnerId as placeholder
          await tx.confidenceWager.create({
            data: {
              matchId,
              winnerId: winner.userId,
              loserId: winner.userId,
              winnerStake,
              loserStake: BOT_STAKE,
              winnerPayout: effectivePayout,
              bonusApplied: isAsymmetric,
              bonusAmount,
            },
          });
        }
        // Fan Competition — update winner's score and add skim to pot
        if (netProfit > 0 && !winnerIsBot) {
          await tx.worldCupEntry.update({
            where: { userId: winner.userId },
            data: { fanScore: { increment: netProfit } },
          });
          if (fanSkim > 0) {
            await tx.houseConfig.update({
              where: { id: 1 },
              data: { wcFanPot: { increment: fanSkim } },
            });
          }
        }
      });

      settled++;
    }
  }

  await prisma.worldCupMatch.update({ where: { id: matchId }, data: { settled: true } });

  // Award 3 Monitor Cans to every player backing the winning team
  if (winnerTeamId !== null) {
    const winnerEntries = await prisma.worldCupEntry.findMany({
      where: { OR: [{ teamId: winnerTeamId }, { proxyTeamId: winnerTeamId }] },
    });
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

  return runSync();
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}

async function runSync() {
  try {
    const data = await fdFetch("/competitions/WC/matches");
    const matches: {
      id: number; status: string; stage: string; group: string | null;
      utcDate: string;
      homeTeam: FdTeam; awayTeam: FdTeam;
      score: { winner: string | null; fullTime: { home: number | null; away: number | null } };
    }[] = data.matches ?? [];

    if (matches.length === 0) {
      console.warn("[wc-sync] API returned 0 matches — competition may not be available yet or code may have changed");
    }

    let upserted = 0;
    let settled = 0;
    const matchErrors: string[] = [];

    for (const m of matches) {
      try {
        // Match on tla code first, then fall back to fuzzy name matching
        const homeTeam = await findWcTeam(m.homeTeam);
        const awayTeam = await findWcTeam(m.awayTeam);

        const dbMatch = await prisma.worldCupMatch.upsert({
          where: { fdMatchId: m.id },
          create: {
            fdMatchId: m.id,
            homeTeamId: homeTeam?.id ?? null,
            awayTeamId: awayTeam?.id ?? null,
            homeTeamName: m.homeTeam.name ?? "TBD",
            awayTeamName: m.awayTeam.name ?? "TBD",
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
      } catch (matchErr) {
        const msg = matchErr instanceof Error ? matchErr.message : String(matchErr);
        console.error(`[wc-sync] match ${m.id} (${m.homeTeam.name} vs ${m.awayTeam.name}) failed:`, msg);
        matchErrors.push(`match ${m.id}: ${msg}`);
      }
    }

    // Sync bracket slots — shared with the manual "Sync Matches" admin action
    const bracketSlots = await seedBracketSlots(matches);

    // Auto-lock bracket when R32 has started — set bracketLockedAt to earliest R32 kickoff if not already set
    const r32Matches = matches.filter(m => STAGE_TO_ROUND[m.stage] === "R32");
    const anyR32Started = r32Matches.some(m => !["SCHEDULED", "TIMED"].includes(m.status));
    if (anyR32Started) {
      const config = await prisma.houseConfig.findUnique({ where: { id: 1 }, select: { bracketLockedAt: true } });
      if (!config?.bracketLockedAt) {
        const earliestKickoff = r32Matches.reduce<Date | null>((min, m) => {
          const k = new Date(m.utcDate);
          return (!min || k < min) ? k : min;
        }, null);
        await prisma.houseConfig.upsert({
          where: { id: 1 },
          create: { id: 1, bracketLockedAt: earliestKickoff ?? new Date() },
          update: { bracketLockedAt: earliestKickoff ?? new Date() },
        });
      }
    }

    return NextResponse.json({ ok: true, upserted, settled, bracketSlots, matchErrors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[wc-sync] fatal error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
