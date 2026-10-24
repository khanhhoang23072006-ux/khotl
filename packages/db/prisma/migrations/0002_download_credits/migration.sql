-- Hạn mức tải xuống và lượt thưởng

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('DAILY', 'SPEND', 'UPLOAD_REWARD', 'BONUS', 'REVOKE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DownloadCharge" AS ENUM ('FREE', 'BONUS', 'REPEAT', 'EXEMPT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CREDITS_CHANGED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "creditDebt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rewardsLockReason" TEXT,
ADD COLUMN     "rewardsLockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN     "simhash" BIGINT;

-- AlterTable
ALTER TABLE "download_logs" ADD COLUMN     "charge" "DownloadCharge" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "deviceHash" TEXT;

-- CreateTable
CREATE TABLE "download_quotas" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "download_quotas_pkey" PRIMARY KEY ("userId","date")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL DEFAULT 0,
    "documentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "actorId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_tokens" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_tokens_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "device_sightings" (
    "deviceHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipHash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sightings_pkey" PRIMARY KEY ("deviceHash","userId")
);

-- CreateIndex
CREATE INDEX "download_logs_userId_documentId_createdAt_idx" ON "download_logs"("userId", "documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_dedupeKey_key" ON "credit_ledger"("dedupeKey");

-- CreateIndex
CREATE INDEX "credit_ledger_userId_createdAt_idx" ON "credit_ledger"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "credit_ledger_userId_expiresAt_idx" ON "credit_ledger"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "credit_ledger_documentId_idx" ON "credit_ledger"("documentId");

-- CreateIndex
CREATE INDEX "download_tokens_expiresAt_idx" ON "download_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "device_sightings_userId_idx" ON "device_sightings"("userId");

-- AddForeignKey
ALTER TABLE "download_quotas" ADD CONSTRAINT "download_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dọn token đã hết hạn được làm ở worker; số lượt không bao giờ âm
ALTER TABLE "download_quotas" ADD CONSTRAINT "download_quotas_used_check" CHECK ("used" >= 0);
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_remaining_check" CHECK ("remaining" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "users_creditDebt_check" CHECK ("creditDebt" >= 0);
