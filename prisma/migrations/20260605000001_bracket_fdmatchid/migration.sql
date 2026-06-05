-- AlterTable: add fdMatchId to BracketSlot
ALTER TABLE "BracketSlot" ADD COLUMN "fdMatchId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "BracketSlot_fdMatchId_key" ON "BracketSlot"("fdMatchId");
