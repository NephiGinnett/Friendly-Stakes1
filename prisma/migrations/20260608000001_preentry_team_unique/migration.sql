-- Enforce one pre-registration per team (NULLs are exempt from UNIQUE in SQLite)
CREATE UNIQUE INDEX "WorldCupPreEntry_teamId_key" ON "WorldCupPreEntry"("teamId");
