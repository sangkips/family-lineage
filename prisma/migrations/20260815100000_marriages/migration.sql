-- AlterTable
ALTER TABLE "PendingEdit" ADD COLUMN     "marriageId" TEXT,
ALTER COLUMN "personId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Marriage" (
    "id" TEXT NOT NULL,
    "partnerAId" TEXT NOT NULL,
    "partnerBId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "startPrecision" "DatePrecision" NOT NULL DEFAULT 'YEAR',
    "endDate" TIMESTAMP(3),
    "endReason" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'PENDING',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marriage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Marriage_partnerAId_idx" ON "Marriage"("partnerAId");

-- CreateIndex
CREATE INDEX "Marriage_partnerBId_idx" ON "Marriage"("partnerBId");

-- CreateIndex
CREATE INDEX "Marriage_status_idx" ON "Marriage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Marriage_partnerAId_partnerBId_key" ON "Marriage"("partnerAId", "partnerBId");

-- CreateIndex
CREATE INDEX "PendingEdit_marriageId_idx" ON "PendingEdit"("marriageId");

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_partnerAId_fkey" FOREIGN KEY ("partnerAId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marriage" ADD CONSTRAINT "Marriage_partnerBId_fkey" FOREIGN KEY ("partnerBId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEdit" ADD CONSTRAINT "PendingEdit_marriageId_fkey" FOREIGN KEY ("marriageId") REFERENCES "Marriage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

