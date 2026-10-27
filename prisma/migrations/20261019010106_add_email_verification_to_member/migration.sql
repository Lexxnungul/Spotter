-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "memberNumber" TEXT,
    "passwordHash" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'BASIC',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingBalanceKobo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" DATETIME
);
INSERT INTO "new_Member" ("createdAt", "email", "expiryDate", "fullName", "id", "memberNumber", "openingBalanceKobo", "passwordHash", "phone", "status", "tier") SELECT "createdAt", "email", "expiryDate", "fullName", "id", "memberNumber", "openingBalanceKobo", "passwordHash", "phone", "status", "tier" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_phone_key" ON "Member"("phone");
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");
CREATE INDEX "Member_status_idx" ON "Member"("status");
CREATE INDEX "Member_memberNumber_idx" ON "Member"("memberNumber");
CREATE INDEX "Member_email_idx" ON "Member"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
