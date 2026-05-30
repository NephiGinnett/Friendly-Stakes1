-- CreateTable
CREATE TABLE "WorldCupTeam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "confederation" TEXT NOT NULL,
    "group" TEXT
);

-- CreateTable
CREATE TABLE "WorldCupEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 500,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldCupEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorldCupEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorldCupTeam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorldCupMatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fdMatchId" INTEGER NOT NULL,
    "homeTeamId" INTEGER,
    "awayTeamId" INTEGER,
    "homeTeamName" TEXT NOT NULL,
    "awayTeamName" TEXT NOT NULL,
    "kickoff" DATETIME NOT NULL,
    "stage" TEXT NOT NULL,
    "group" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "winner" TEXT,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorldCupMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "WorldCupTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorldCupMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "WorldCupTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfidenceWager" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "opponentId" INTEGER,
    "creatorTeam" TEXT NOT NULL,
    "opponentTeam" TEXT NOT NULL,
    "creatorStake" INTEGER NOT NULL DEFAULT 100,
    "opponentStake" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'open',
    "winnerId" INTEGER,
    "bonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME,
    CONSTRAINT "ConfidenceWager_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "WorldCupMatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfidenceWager_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfidenceWager_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "phase" INTEGER NOT NULL DEFAULT 0,
    "bossActive" BOOLEAN NOT NULL DEFAULT false,
    "bossHp" INTEGER NOT NULL DEFAULT 0,
    "bossMaxHp" INTEGER NOT NULL DEFAULT 0,
    "killerUserId" INTEGER,
    "nextStrikeAt" DATETIME,
    "sacrificeOpen" BOOLEAN NOT NULL DEFAULT false,
    "sacrificeBonusHp" INTEGER NOT NULL DEFAULT 0,
    "casinoOpen" BOOLEAN NOT NULL DEFAULT true,
    "bossHpMultiplier" INTEGER NOT NULL DEFAULT 3000,
    "botsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "arFaireActive" BOOLEAN NOT NULL DEFAULT true,
    "worldCupAdminAt" DATETIME,
    "worldCupPlayerAt" DATETIME,
    "worldCupEventEndAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HouseConfig" ("bossActive", "bossHp", "bossHpMultiplier", "bossMaxHp", "botsEnabled", "casinoOpen", "id", "killerUserId", "nextStrikeAt", "phase", "sacrificeBonusHp", "sacrificeOpen", "updatedAt") SELECT "bossActive", "bossHp", "bossHpMultiplier", "bossMaxHp", "botsEnabled", "casinoOpen", "id", "killerUserId", "nextStrikeAt", "phase", "sacrificeBonusHp", "sacrificeOpen", "updatedAt" FROM "HouseConfig";
DROP TABLE "HouseConfig";
ALTER TABLE "new_HouseConfig" RENAME TO "HouseConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WorldCupTeam_name_key" ON "WorldCupTeam"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorldCupTeam_code_key" ON "WorldCupTeam"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorldCupEntry_userId_key" ON "WorldCupEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldCupMatch_fdMatchId_key" ON "WorldCupMatch"("fdMatchId");
