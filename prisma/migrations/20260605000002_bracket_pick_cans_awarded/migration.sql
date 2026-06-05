-- AlterTable: track whether monitor cans have been awarded for a correct bracket pick
ALTER TABLE "BracketPick" ADD COLUMN "cansAwarded" BOOLEAN NOT NULL DEFAULT false;
