import crypto from 'crypto';

export const CHECKIN_CODE_EXPIRY_MS = 10 * 60 * 1000;

interface PendingCheckInCode {
  codeHash: string;
  memberId: string;
  fullName: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

type CheckInCodeLookup =
  | { status: 'valid'; codeHash: string; record: PendingCheckInCode }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'used' };

const pendingCheckInCodes = new Map<string, PendingCheckInCode>();

function hashCheckInCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function pruneExpiredCodes(now: number): void {
  for (const [codeHash, record] of Array.from(pendingCheckInCodes.entries())) {
    if (record.expiresAt.getTime() <= now) {
      pendingCheckInCodes.delete(codeHash);
    }
  }
}

export function generateCheckInCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function createCheckInCode(data: {
  memberId: string;
  fullName: string;
  email: string;
}): { code: string; createdAt: Date; expiresAt: Date } {
  const now = Date.now();
  pruneExpiredCodes(now);

  for (const [codeHash, record] of Array.from(pendingCheckInCodes.entries())) {
    if (record.memberId === data.memberId) {
      pendingCheckInCodes.delete(codeHash);
    }
  }

  const code = generateCheckInCode();
  const codeHash = hashCheckInCode(code);
  const createdAt = new Date(now);
  const expiresAt = new Date(now + CHECKIN_CODE_EXPIRY_MS);

  pendingCheckInCodes.set(codeHash, {
    codeHash,
    memberId: data.memberId,
    fullName: data.fullName,
    email: data.email,
    createdAt,
    expiresAt,
    usedAt: null,
  });

  return { code, createdAt, expiresAt };
}

export function lookupCheckInCode(code: string): CheckInCodeLookup {
  const codeHash = hashCheckInCode(code.trim());
  const record = pendingCheckInCodes.get(codeHash);

  if (!record) {
    return { status: 'not_found' };
  }
  if (record.usedAt) {
    return { status: 'used' };
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    pendingCheckInCodes.delete(codeHash);
    return { status: 'expired' };
  }

  return { status: 'valid', codeHash, record };
}

export function markCheckInCodeUsed(codeHash: string): void {
  const record = pendingCheckInCodes.get(codeHash);
  if (record) {
    record.usedAt = new Date();
  }
}

export function resetCheckInCodeStore(): void {
  pendingCheckInCodes.clear();
}
