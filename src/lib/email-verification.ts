import crypto from 'crypto';
import { prisma } from './prisma';

export interface PendingVerification {
  email: string;
  code: string;
  memberId?: string;
  expiresAt: number;
  createdAt: number;
  attempts: number;
}

// In-memory store for active verification requests
const pendingVerifications = new Map<string, PendingVerification>();

// In-memory cache for verified emails
const verifiedEmailsCache = new Set<string>();

// Code expiration: 15 minutes
export const VERIFICATION_EXPIRY_MS = 15 * 60 * 1000;

// Resend cooldown: 30 seconds
export const RESEND_COOLDOWN_MS = 30 * 1000;

// Maximum incorrect attempts before code is invalidated
export const MAX_VERIFICATION_ATTEMPTS = 5;

/**
 * Generates a cryptographically secure 6-digit verification code
 * using Node's crypto.randomBytes algorithm.
 *
 * Mapped to 100,000 - 999,999 to guarantee a uniform 6-digit integer string.
 */
export function generateVerificationCode(): string {
  const buffer = crypto.randomBytes(4);
  const codeInt = 100000 + (buffer.readUInt32BE(0) % 900000);
  return codeInt.toString();
}

/**
 * Creates and stores a 6-digit verification code for a given email address.
 * Enforces a 30-second cooldown between code generations.
 */
export function createVerificationCode(
  email: string,
  memberId?: string
): { success: boolean; code?: string; error?: string; retryAfterSeconds?: number } {
  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();

  const existing = pendingVerifications.get(cleanEmail);
  if (existing) {
    const elapsed = now - existing.createdAt;
    if (elapsed < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        error: `Please wait ${retryAfterSeconds} seconds before requesting a new code.`,
        retryAfterSeconds,
      };
    }
  }

  const code = generateVerificationCode();
  pendingVerifications.set(cleanEmail, {
    email: cleanEmail,
    code,
    memberId,
    expiresAt: now + VERIFICATION_EXPIRY_MS,
    createdAt: now,
    attempts: 0,
  });

  return { success: true, code };
}

/**
 * Verifies a 6-digit code for the specified email.
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return {
      success: false,
      error: 'Verification code must be exactly 6 digits.',
    };
  }

  const record = pendingVerifications.get(cleanEmail);
  if (!record) {
    return {
      success: false,
      error: 'No active verification code found for this email. Please request a new code.',
    };
  }

  // Check expiration
  if (Date.now() > record.expiresAt) {
    pendingVerifications.delete(cleanEmail);
    return {
      success: false,
      error: 'Verification code has expired. Please request a new one.',
    };
  }

  // Check attempt limit
  if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    pendingVerifications.delete(cleanEmail);
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new verification code.',
    };
  }

  // Check code match
  if (record.code !== cleanCode) {
    record.attempts += 1;
    const remaining = MAX_VERIFICATION_ATTEMPTS - record.attempts;
    if (remaining <= 0) {
      pendingVerifications.delete(cleanEmail);
      return {
        success: false,
        error: 'Too many incorrect attempts. Please request a new verification code.',
      };
    }
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
    };
  }

  // Code verified successfully
  pendingVerifications.delete(cleanEmail);
  verifiedEmailsCache.add(cleanEmail);

  // Persist verified status directly in Member table in the database
  try {
    await prisma.member.updateMany({
      where: { email: cleanEmail },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  } catch {}

  // Also maintain Setting for backward compatibility / fallback
  try {
    await prisma.setting.upsert({
      where: { key: `email_verified:${cleanEmail}` },
      create: {
        key: `email_verified:${cleanEmail}`,
        value: new Date().toISOString(),
      },
      update: {
        value: new Date().toISOString(),
      },
    });
  } catch {
    // In-memory cache ensures functionality even if database is temporarily unavailable
  }

  return { success: true };
}

/**
 * Checks if an email has been verified.
 */
export async function isEmailVerified(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();

  // Pre-verified demo members
  if (cleanEmail === 'chioma@example.com' || cleanEmail === 'owner@spottergym.com' || cleanEmail === 'desk@spottergym.com') {
    return true;
  }

  if (verifiedEmailsCache.has(cleanEmail)) {
    return true;
  }

  try {
    const member = await prisma.member.findFirst({
      where: { email: cleanEmail },
      select: { isEmailVerified: true },
    });

    if (member && member.isEmailVerified) {
      verifiedEmailsCache.add(cleanEmail);
      return true;
    }

    const setting = await prisma.setting.findUnique({
      where: { key: `email_verified:${cleanEmail}` },
    });

    if (setting) {
      verifiedEmailsCache.add(cleanEmail);
      return true;
    }
  } catch {
    // Database query failed, rely on in-memory cache
  }

  return false;
}

/**
 * Explicitly marks an email as verified (useful for administrative or testing purposes)
 */
export async function markEmailVerified(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  verifiedEmailsCache.add(cleanEmail);
  pendingVerifications.delete(cleanEmail);

  try {
    await prisma.member.updateMany({
      where: { email: cleanEmail },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  } catch {}

  try {
    await prisma.setting.upsert({
      where: { key: `email_verified:${cleanEmail}` },
      create: {
        key: `email_verified:${cleanEmail}`,
        value: new Date().toISOString(),
      },
      update: {
        value: new Date().toISOString(),
      },
    });
  } catch {}
}

/**
 * Retrieves the pending verification record for an email (for testing or inspection)
 */
export function getPendingVerification(email: string): PendingVerification | undefined {
  return pendingVerifications.get(email.trim().toLowerCase());
}

/**
 * Resets the verification store (for unit tests)
 */
export async function resetVerificationStore(): Promise<void> {
  pendingVerifications.clear();
  verifiedEmailsCache.clear();
  try {
    await prisma.setting.deleteMany({
      where: {
        key: {
          startsWith: 'email_verified:',
        },
      },
    });
  } catch {}
}
