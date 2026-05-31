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
    "leakAchievementId" TEXT,
    "leakRefreshedAt" DATETIME,
    "strikesSinceLeak" INTEGER NOT NULL DEFAULT 0,
    "worldCupAdminAt" DATETIME,
    "worldCupPlayerAt" DATETIME,
    "worldCupEventEndAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HouseConfig" ("arFaireActive", "bossActive", "bossHp", "bossHpMultiplier", "bossMaxHp", "botsEnabled", "casinoOpen", "id", "killerUserId", "nextStrikeAt", "phase", "sacrificeBonusHp", "sacrificeOpen", "updatedAt", "worldCupAdminAt", "worldCupEventEndAt", "worldCupPlayerAt") SELECT "arFaireActive", "bossActive", "bossHp", "bossHpMultiplier", "bossMaxHp", "botsEnabled", "casinoOpen", "id", "killerUserId", "nextStrikeAt", "phase", "sacrificeBonusHp", "sacrificeOpen", "updatedAt", "worldCupAdminAt", "worldCupEventEndAt", "worldCupPlayerAt" FROM "HouseConfig";
DROP TABLE "HouseConfig";
ALTER TABLE "new_HouseConfig" RENAME TO "HouseConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
