-- Data-preserving migration: rename Payment -> PaymentLog and add full payment user-journey & verification fields.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1. Create new PaymentLog table
CREATE TABLE "PaymentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'BASIC',
    "method" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "currentStage" TEXT NOT NULL DEFAULT 'MODAL_OPENED',
    "journeyEvents" TEXT NOT NULL DEFAULT '[]',
    "idempotencyKey" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "gatewayTxId" TEXT,
    "gatewayStatus" TEXT,
    "verifiedSource" TEXT,
    "verifiedAt" DATETIME,
    "failureReason" TEXT,
    "typistId" TEXT,
    "reversalOfId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    CONSTRAINT "PaymentLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentLog_typistId_fkey" FOREIGN KEY ("typistId") REFERENCES "StaffAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 2. Migrate all existing Payment rows cleanly into PaymentLog
INSERT INTO "PaymentLog" (
    "id",
    "memberId",
    "purpose",
    "tier",
    "method",
    "amountKobo",
    "status",
    "currentStage",
    "journeyEvents",
    "idempotencyKey",
    "gatewayRef",
    "gatewayTxId",
    "gatewayStatus",
    "verifiedSource",
    "verifiedAt",
    "failureReason",
    "typistId",
    "reversalOfId",
    "createdAt",
    "updatedAt",
    "confirmedAt"
)
SELECT
    "id",
    "memberId",
    "purpose",
    CASE
        WHEN "amountKobo" >= 4500000 THEN 'DIAMOND'
        WHEN "amountKobo" >= 2500000 THEN 'PREMIUM'
        ELSE 'BASIC'
    END,
    "method",
    "amountKobo",
    "status",
    CASE
        WHEN "status" = 'SUCCESS' AND "method" IN ('CASH', 'TRANSFER', 'POS') THEN 'DESK_RECORDED'
        WHEN "status" = 'SUCCESS' THEN 'VERIFIED_SUCCESS'
        WHEN "status" = 'FAILED' THEN 'FAILED'
        WHEN "status" = 'ABANDONED' THEN 'ABANDONED_MODAL'
        WHEN "status" = 'PENDING' THEN 'RETURNED_FROM_GATEWAY'
        ELSE 'INITIATED'
    END,
    '[{"stage":"' ||
        CASE
            WHEN "status" = 'SUCCESS' AND "method" IN ('CASH', 'TRANSFER', 'POS') THEN 'DESK_RECORDED'
            WHEN "status" = 'SUCCESS' THEN 'VERIFIED_SUCCESS'
            WHEN "status" = 'FAILED' THEN 'FAILED'
            WHEN "status" = 'ABANDONED' THEN 'ABANDONED_MODAL'
            WHEN "status" = 'PENDING' THEN 'RETURNED_FROM_GATEWAY'
            ELSE 'INITIATED'
        END ||
        '","status":"' || "status" || '","actor":"migration_backfill","detail":"Migrated from Payment table","timestamp":"' || COALESCE("confirmedAt", "createdAt") || '"}]',
    "idempotencyKey",
    "gatewayRef",
    NULL,
    CASE WHEN "status" = 'SUCCESS' THEN 'successful' ELSE NULL END,
    CASE
        WHEN "status" = 'SUCCESS' AND "method" IN ('CASH', 'TRANSFER', 'POS') THEN 'DESK'
        WHEN "status" = 'SUCCESS' THEN 'WEBHOOK'
        ELSE NULL
    END,
    CASE WHEN "status" = 'SUCCESS' THEN COALESCE("confirmedAt", "createdAt") ELSE NULL END,
    NULL,
    "typistId",
    "reversalOfId",
    "createdAt",
    COALESCE("confirmedAt", "createdAt"),
    "confirmedAt"
FROM "Payment";

-- 3. Redefine PaymentAttempt with paymentLogId referencing PaymentLog(id) and preserve existing attempts
CREATE TABLE "new_PaymentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentLogId" TEXT NOT NULL,
    "stage" TEXT,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAttempt_paymentLogId_fkey" FOREIGN KEY ("paymentLogId") REFERENCES "PaymentLog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_PaymentAttempt" ("id", "paymentLogId", "stage", "status", "detail", "at")
SELECT "id", "paymentId", "status", "status", "detail", "at" FROM "PaymentAttempt";

DROP TABLE "PaymentAttempt";
ALTER TABLE "new_PaymentAttempt" RENAME TO "PaymentAttempt";

-- 4. Drop legacy Payment indexes & table after data copy
DROP INDEX IF EXISTS "Payment_memberId_idx";
DROP INDEX IF EXISTS "Payment_gatewayRef_key";
DROP INDEX IF EXISTS "Payment_idempotencyKey_key";
DROP TABLE "Payment";

-- 5. Recreate indexes matching Prisma schema
CREATE UNIQUE INDEX "PaymentLog_idempotencyKey_key" ON "PaymentLog"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentLog_gatewayRef_key" ON "PaymentLog"("gatewayRef");
CREATE INDEX "PaymentLog_memberId_idx" ON "PaymentLog"("memberId");
CREATE INDEX "PaymentLog_memberId_status_idx" ON "PaymentLog"("memberId", "status");
CREATE INDEX "PaymentLog_status_currentStage_idx" ON "PaymentLog"("status", "currentStage");
CREATE INDEX "PaymentAttempt_paymentLogId_idx" ON "PaymentAttempt"("paymentLogId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

