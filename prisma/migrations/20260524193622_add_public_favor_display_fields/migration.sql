-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Wager" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "creatorId" INTEGER NOT NULL,
    "creatorPosition" TEXT NOT NULL,
    "creatorStake" INTEGER NOT NULL,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "winnerSide" TEXT,
    "settledAt" DATETIME,
    "settledBy" TEXT,
    "vpnActive" BOOLEAN NOT NULL DEFAULT false,
    "vpnSeed" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "creatorLockedPayout" INTEGER NOT NULL DEFAULT 0,
    "publicFavorForVotes" INTEGER NOT NULL DEFAULT 0,
    "publicFavorForPts" INTEGER NOT NULL DEFAULT 0,
    "publicFavorAgainstVotes" INTEGER NOT NULL DEFAULT 0,
    "publicFavorAgainstPts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wager_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Wager" ("createdAt", "creatorId", "creatorLockedPayout", "creatorPosition", "creatorStake", "deadline", "description", "id", "isPublic", "settledAt", "settledBy", "status", "title", "vpnActive", "vpnSeed", "winnerSide") SELECT "createdAt", "creatorId", "creatorLockedPayout", "creatorPosition", "creatorStake", "deadline", "description", "id", "isPublic", "settledAt", "settledBy", "status", "title", "vpnActive", "vpnSeed", "winnerSide" FROM "Wager";
DROP TABLE "Wager";
ALTER TABLE "new_Wager" RENAME TO "Wager";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
