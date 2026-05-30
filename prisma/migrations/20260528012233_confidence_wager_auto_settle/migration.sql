/*
  Warnings:

  - You are about to drop the column `createdAt` on the `ConfidenceWager` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `ConfidenceWager` table. All the data in the column will be lost.
  - You are about to drop the column `creatorStake` on the `ConfidenceWager` table. All the data in the column will be lost.
  - You are about to drop the column `creatorTeam` on the `ConfidenceWager` table. All the data in the column will be lost.
  - You are about to drop the column `opponentId` on the `ConfidenceWager` table. All the data in the column will be lost.
  - You are about to drop the column `opponentStake` on the `ConfidenceWager` table. All the data in the column will be lost.
  - You are about to drop the column `opponentTeam` on the `ConfidenceWager` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ConfidenceWager` table. All the data in the column will be lost.
  - Added the required column `loserId` to the `ConfidenceWager` table without a default value. This is not possible if the table is not empty.
  - Added the required column `loserStake` to the `ConfidenceWager` table without a default value. This is not possible if the table is not empty.
  - Added the required column `winnerPayout` to the `ConfidenceWager` table without a default value. This is not possible if the table is not empty.
  - Added the required column `winnerStake` to the `ConfidenceWager` table without a default value. This is not possible if the table is not empty.
  - Made the column `winnerId` on table `ConfidenceWager` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConfidenceWager" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "winnerId" INTEGER NOT NULL,
    "loserId" INTEGER NOT NULL,
    "winnerStake" INTEGER NOT NULL,
    "loserStake" INTEGER NOT NULL,
    "winnerPayout" INTEGER NOT NULL,
    "bonusApplied" BOOLEAN NOT NULL DEFAULT false,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "settledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfidenceWager_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "WorldCupMatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfidenceWager_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConfidenceWager_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ConfidenceWager" ("bonusAmount", "bonusApplied", "id", "matchId", "settledAt", "winnerId") SELECT "bonusAmount", "bonusApplied", "id", "matchId", coalesce("settledAt", CURRENT_TIMESTAMP) AS "settledAt", "winnerId" FROM "ConfidenceWager";
DROP TABLE "ConfidenceWager";
ALTER TABLE "new_ConfidenceWager" RENAME TO "ConfidenceWager";
CREATE TABLE "new_WorldCupEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 500,
    "confidenceStake" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldCupEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorldCupEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorldCupTeam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorldCupEntry" ("createdAt", "id", "paid", "teamId", "userId") SELECT "createdAt", "id", "paid", "teamId", "userId" FROM "WorldCupEntry";
DROP TABLE "WorldCupEntry";
ALTER TABLE "new_WorldCupEntry" RENAME TO "WorldCupEntry";
CREATE UNIQUE INDEX "WorldCupEntry_userId_key" ON "WorldCupEntry"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
