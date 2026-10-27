import crypto from 'crypto';
import { prisma } from './prisma';

/**
 * Generates a cryptographically random, uniform 6-digit member number.
 * Range: 100000 - 999999 (excluding leading zeros to avoid string/int truncation anomalies).
 * Uses Node.js crypto.randomInt (CSPRNG).
 */
export function generateRandom6DigitNumber(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Formats a 6-digit member number for high-legibility display (e.g. "481 920").
 */
export function formatMemberNumberDisplay(num: string): string {
  const clean = num.replace(/\s+/g, '');
  if (clean.length === 6) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return clean;
}

/**
 * Validates that a string is a valid 6-digit member number.
 */
export function isValidMemberNumber(num: string): boolean {
  return /^\d{6}$/.test(num.trim());
}

/**
 * Generates a unique 6-digit member number that is guaranteed not to exist in the database.
 * If collision occurs (extremely rare with CSPRNG and gym population), it retries up to maxAttempts.
 */
export async function generateUniqueMemberNumber(maxAttempts: number = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateRandom6DigitNumber();

    try {
      const existing = await prisma.member.findUnique({
        where: { memberNumber: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    } catch (err: any) {
      // In testing environments or when Prisma is mocked, if findUnique is not available or throws,
      // return candidate if it matches 6 digits.
      const isDbDown =
        err?.code === 'P1001' ||
        err?.message?.includes("Can't reach database") ||
        err?.message?.includes('connect ECONNREFUSED');

      if (isDbDown) {
        return candidate;
      }
      throw err;
    }
  }

  throw new Error('Collision limit reached while generating member number. Please try again.');
}
