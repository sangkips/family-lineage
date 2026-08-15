-- Anonymous contribution rework: submissions become the unit of review.

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('YEAR', 'MONTH', 'DAY');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "birthDatePrecision" "DatePrecision" NOT NULL DEFAULT 'DAY';

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "submitterHash" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Submission_decision_submittedAt_idx" ON "Submission"("decision", "submittedAt");

-- AlterTable
ALTER TABLE "PendingEdit" ADD COLUMN     "duplicateIds" TEXT[],
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "submissionId" TEXT;

-- Backfill: every existing PendingEdit becomes a one-person Submission that
-- carries its review outcome, so the audit trail survives the column drop
-- below. Runs before the drop for exactly that reason.
INSERT INTO "Submission" ("id", "kind", "submittedAt", "decision", "reviewedBy", "reviewedAt", "adminNote")
SELECT "id", 'ADD_PEOPLE', "submittedAt", "decision", "reviewedBy", "reviewedAt", "adminNote"
FROM "PendingEdit";

UPDATE "PendingEdit" SET "submissionId" = "id";

-- DropIndex
DROP INDEX "PendingEdit_decision_idx";

-- AlterTable
ALTER TABLE "PendingEdit" DROP COLUMN "adminNote",
DROP COLUMN "decision",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedBy",
DROP COLUMN "submittedBy";

-- CreateIndex
CREATE INDEX "PendingEdit_submissionId_idx" ON "PendingEdit"("submissionId");

-- AddForeignKey
ALTER TABLE "PendingEdit" ADD CONSTRAINT "PendingEdit_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
