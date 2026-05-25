-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "pinSalt" TEXT NOT NULL,
    "pinPlain" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL DEFAULT 1000,
    "totalDonated" INTEGER NOT NULL DEFAULT 0,
    "challengeMultiplier" INTEGER NOT NULL DEFAULT 1,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "houseBanDate" TEXT NOT NULL DEFAULT '',
    "discordUserId" TEXT,
    "password" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "passwordSalt" TEXT NOT NULL DEFAULT '',
    "adViewDate" TEXT NOT NULL DEFAULT '',
    "adViewCount" INTEGER NOT NULL DEFAULT 0,
    "hasWatchedAd" BOOLEAN NOT NULL DEFAULT false,
    "syscoSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "pwAssistHour" TEXT NOT NULL DEFAULT '',
    "pwAssistCount" INTEGER NOT NULL DEFAULT 0,
    "publicWagerWins" INTEGER NOT NULL DEFAULT 0,
    "publicWagerCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkTokens" INTEGER NOT NULL DEFAULT 0,
    "arGachaPulls" INTEGER NOT NULL DEFAULT 0,
    "gachaPityCounter" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wager" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wager_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WagerEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wagerId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "lockedPayout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WagerEntry_wagerId_fkey" FOREIGN KEY ("wagerId") REFERENCES "Wager" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WagerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wagerId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "choice" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_wagerId_fkey" FOREIGN KEY ("wagerId") REFERENCES "Wager" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "usesLeft" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "achievementId" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "frozenData" TEXT,
    "unlockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PointLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BingoItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "creatorId" INTEGER NOT NULL,
    "targetId" INTEGER,
    "acceptedById" INTEGER,
    "offer" INTEGER NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winnerUserId" INTEGER,
    "settledAt" DATETIME,
    "vpnActive" BOOLEAN NOT NULL DEFAULT false,
    "vpnSeed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Challenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Challenge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Challenge_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChallengeVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "challengeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "choice" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChallengeVote_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChallengeVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseConfig" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SacrificeVote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "voterId" INTEGER NOT NULL,
    "targetId" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SacrificeVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SacrificeVote_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseSpin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "result" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "item" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseSpin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlackjackGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "playerHand" TEXT NOT NULL,
    "dealerHand" TEXT NOT NULL,
    "deck" TEXT NOT NULL,
    "bet" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dailyPlays" INTEGER NOT NULL DEFAULT 0,
    "dailyDate" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BlackjackGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseDamageLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseDamageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseAttackLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "flavorText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseAttackLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArBookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "quizId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArBookmark_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "ArQuiz" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArQuiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "sponsorId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArQuiz_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quizId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "choiceA" TEXT NOT NULL,
    "choiceB" TEXT NOT NULL,
    "choiceC" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    CONSTRAINT "ArQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "ArQuiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArQuizAttempt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "quizId" INTEGER NOT NULL,
    "answers" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "tokensAwarded" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArQuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArQuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "ArQuiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArQuizCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "quizId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArQuizCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArQuizCompletion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "ArQuiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBookmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "bookmarkId" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserBookmark_bookmarkId_fkey" FOREIGN KEY ("bookmarkId") REFERENCES "ArBookmark" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminDistribution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardAmount" INTEGER NOT NULL DEFAULT 0,
    "rewardItem" TEXT NOT NULL DEFAULT '',
    "rewardItemUses" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminDistributionClaim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "distributionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminDistributionClaim_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "AdminDistribution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdminDistributionClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wagerId" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "botType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotEntry_wagerId_fkey" FOREIGN KEY ("wagerId") REFERENCES "Wager" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BotPersonality" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "lossStreak" INTEGER NOT NULL DEFAULT 0,
    "pointsWon" INTEGER NOT NULL DEFAULT 0,
    "pointsLost" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "BingoSquare" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "bingoItemId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "claimStatus" TEXT NOT NULL DEFAULT 'none',
    "claimNote" TEXT,
    "claimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BingoSquare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BingoSquare_bingoItemId_fkey" FOREIGN KEY ("bingoItemId") REFERENCES "BingoItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "WagerEntry_wagerId_userId_key" ON "WagerEntry"("wagerId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_wagerId_userId_key" ON "Vote"("wagerId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeVote_challengeId_userId_key" ON "ChallengeVote"("challengeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SacrificeVote_voterId_key" ON "SacrificeVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "BlackjackGame_userId_key" ON "BlackjackGame"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArBookmark_quizId_key" ON "ArBookmark"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "ArQuizCompletion_userId_quizId_key" ON "ArQuizCompletion"("userId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBookmark_userId_bookmarkId_key" ON "UserBookmark"("userId", "bookmarkId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminDistributionClaim_distributionId_userId_key" ON "AdminDistributionClaim"("distributionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BingoSquare_userId_position_key" ON "BingoSquare"("userId", "position");
