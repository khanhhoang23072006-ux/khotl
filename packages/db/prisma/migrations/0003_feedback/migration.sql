-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'ACCOUNT', 'CONTENT', 'IDEA', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "reply" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_code_key" ON "feedback"("code");

-- CreateIndex
CREATE INDEX "feedback_status_createdAt_idx" ON "feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

