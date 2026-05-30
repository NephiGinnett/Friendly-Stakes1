-- CreateTable
CREATE TABLE "Parlay" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "proposerId" INTEGER NOT NULL,
    "opponentId" INTEGER NOT NULL,
    "costPerLeg" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proposerWon" BOOLEAN,
    "totalEscrowed" INTEGER NOT NULL DEFAULT 0,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" DATETIME,
    CONSTRAINT "Parlay_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "WorldCupMatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Parlay_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Parlay_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParlayLeg" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parlayId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "accepted" BOOLEAN,
    "proposerVote" BOOLEAN,
    "opponentVote" BOOLEAN,
    "result" BOOLEAN,
    CONSTRAINT "ParlayLeg_parlayId_fkey" FOREIGN KEY ("parlayId") REFERENCES "Parlay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParlayVoteLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parlayId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParlayVoteLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorldCupEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 500,
    "confidenceStake" INTEGER NOT NULL DEFAULT 100,
    "monitorCans" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldCupEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorldCupEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorldCupTeam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorldCupEntry" ("confidenceStake", "createdAt", "id", "paid", "teamId", "userId") SELECT "confidenceStake", "createdAt", "id", "paid", "teamId", "userId" FROM "WorldCupEntry";
DROP TABLE "WorldCupEntry";
ALTER TABLE "new_WorldCupEntry" RENAME TO "WorldCupEntry";
CREATE UNIQUE INDEX "WorldCupEntry_userId_key" ON "WorldCupEntry"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ParlayVoteLog_parlayId_userId_key" ON "ParlayVoteLog"("parlayId", "userId");
