-- AlterTable: add lastShootoutPicks to WorldCupEntry
ALTER TABLE "WorldCupEntry" ADD COLUMN "lastShootoutPicks" TEXT NOT NULL DEFAULT '';

-- CreateTable: WorldCupGameLog
CREATE TABLE "WorldCupGameLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "gameType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "cansEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldCupGameLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
