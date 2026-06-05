-- CreateTable
CREATE TABLE "BracketSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "team1Code" TEXT NOT NULL DEFAULT '',
    "team2Code" TEXT NOT NULL DEFAULT '',
    "winnerCode" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "BracketPick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "round" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "teamCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BracketPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketSlot_round_position_key" ON "BracketSlot"("round", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BracketPick_userId_round_position_key" ON "BracketPick"("userId", "round", "position");

-- AlterTable
ALTER TABLE "HouseConfig" ADD COLUMN "bracketLockedAt" DATETIME;
