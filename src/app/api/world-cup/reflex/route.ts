import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logPoints } from "@/lib/pointLog";
import {
  Zone,
  ALL_ZONES,
  BotType,
  BOT_NAMES,
  BOT_ICONS,
  botKicks,
  cansForScore,
  signKicks,
  verifyKicks,
} from "@/lib/worldCupMiniGames";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const BOT_TYPES: BotType[] = ["house", "shark", "momentum"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({
    where: { userId: user.id },
    include: { team: true },
  });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  const playsToday = await prisma.worldCupGameLog.count({
    where: { userId: user.id, gameType: "reflex", createdAt: { gte: startOfToday() } },
  });

  if (playsToday >= 1) {
    const last = await prisma.worldCupGameLog.findFirst({
      where: { userId: user.id, gameType: "reflex" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      playsToday,
      limit: 1,
      alreadyPlayed: true,
      lastResult: last ? JSON.parse(last.result) : null,
      lastCans: last?.cansEarned ?? 0,
    });
  }

  // Find a real player opponent who has shot before (excluding current user)
  const candidates = await prisma.worldCupEntry.findMany({
    where: { userId: { not: user.id }, lastShootoutPicks: { not: "" } },
    include: { user: true, team: true },
  });

  let opponentName: string;
  let opponentType: "player" | "bot";
  let opponentFlag: string;
  let opponentBotSubtype: BotType | null = null;
  let kicks: Zone[];

  if (candidates.length > 0) {
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    opponentName = chosen.user.username;
    opponentType = "player";
    opponentFlag = chosen.team.flag;
    kicks = JSON.parse(chosen.lastShootoutPicks) as Zone[];
  } else {
    const botType = BOT_TYPES[Math.floor(Math.random() * BOT_TYPES.length)];
    opponentName = BOT_NAMES[botType];
    opponentType = "bot";
    opponentFlag = BOT_ICONS[botType];
    opponentBotSubtype = botType;
    kicks = botKicks(botType);
  }

  // Validate kicks array (defensive: real player's picks might be old/corrupt)
  if (!Array.isArray(kicks) || kicks.length !== 5 || kicks.some((z) => !ALL_ZONES.includes(z))) {
    const botType = BOT_TYPES[Math.floor(Math.random() * BOT_TYPES.length)];
    opponentName = BOT_NAMES[botType];
    opponentType = "bot";
    opponentFlag = BOT_ICONS[botType];
    opponentBotSubtype = botType;
    kicks = botKicks(botType);
  }

  const ts = Math.floor(Date.now() / 1000);
  const token = signKicks(user.id, kicks, ts);

  // Flash window per bot — timer starts before render, so values are generous to account for mobile latency
  const flashMs = opponentBotSubtype === "house" ? 500 : opponentBotSubtype === "shark" ? 650 : 900;

  return NextResponse.json({
    playsToday: 0,
    limit: 1,
    alreadyPlayed: false,
    opponent: { name: opponentName, type: opponentType, flag: opponentFlag, botSubtype: opponentBotSubtype },
    kicks,
    token,
    ts,
    flashMs,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.worldCupEntry.findUnique({ where: { userId: user.id } });
  if (!entry) return NextResponse.json({ error: "Not entered" }, { status: 404 });

  const playsToday = await prisma.worldCupGameLog.count({
    where: { userId: user.id, gameType: "reflex", createdAt: { gte: startOfToday() } },
  });
  if (playsToday >= 1) {
    return NextResponse.json({ error: "Already played today — come back tomorrow" }, { status: 429 });
  }

  const body = await req.json();
  const { opponentName, opponentType, kicks, token, ts, answers } = body as {
    opponentName: string;
    opponentType: string;
    kicks: Zone[];
    token: string;
    ts: number;
    answers: (Zone | null)[];
  };

  if (
    !Array.isArray(kicks) || kicks.length !== 5 ||
    !Array.isArray(answers) || answers.length !== 5 ||
    typeof token !== "string" || typeof ts !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!verifyKicks(user.id, kicks, ts, token)) {
    return NextResponse.json({ error: "Challenge expired or invalid — please refresh" }, { status: 400 });
  }

  const saves = answers.filter((a, i) => a === kicks[i]).length;
  const cansEarned = cansForScore(saves);

  const result = { opponentName, opponentType, kicks, answers, saves };

  await prisma.$transaction(async (tx) => {
    if (cansEarned > 0) {
      await tx.worldCupEntry.update({
        where: { userId: user.id },
        data: { monitorCans: { increment: cansEarned } },
      });
    }
    await tx.worldCupGameLog.create({
      data: {
        userId: user.id,
        gameType: "reflex",
        result: JSON.stringify(result),
        cansEarned,
      },
    });
    if (cansEarned > 0) {
      await logPoints(tx, user.id, 0, `World Cup Keeper's Reflex — saved ${saves}/5 vs ${opponentName}, earned ${cansEarned} 🥤`);
    }
  });

  return NextResponse.json({ saves, cansEarned, kicks, answers });
}
