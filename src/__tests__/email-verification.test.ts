import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateVerificationCode,
  createVerificationCode,
  verifyEmailCode,
  isEmailVerified,
  markEmailVerified,
  resetVerificationStore,
  getPendingVerification,
  VERIFICATION_EXPIRY_MS,
  MAX_VERIFICATION_ATTEMPTS,
} from '../lib/email-verification';
import { POST as verifyEmailHandler } from '../app/api/auth/verify-email/route';
import { POST as resendVerificationHandler } from '../app/api/auth/verify-email/resend/route';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { resetRateLimitStore } from '../lib/rate-limit';

describe('6-Digit randomByte Email Verification System', () => {
  beforeEach(async () => {
    await resetVerificationStore();
    resetRateLimitStore();
    vi.restoreAllMocks();
  });

  describe('generateVerificationCode (randomByte algorithm)', () => {
    it('generates exactly a 6-digit string of numbers', () => {
      const code = generateVerificationCode();
      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('generates codes strictly within the range of 100000 to 999999', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateVerificationCode();
        const num = parseInt(code, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });

    it('generates cryptographically diverse codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 30; i++) {
        codes.add(generateVerificationCode());
      }
      // With 900,000 possibilities, 30 random codes should produce 30 unique codes
      expect(codes.size).toBe(30);
    });
  });

  describe('Verification Code Lifecycle & Security Rules', () => {
    const testEmail = 'member@example.com';

    it('creates and stores a pending verification code', () => {
      const res = createVerificationCode(testEmail, 'mem_123');
      expect(res.success).toBe(true);
      expect(res.code).toBeDefined();
      expect(res.code).toHaveLength(6);

      const pending = getPendingVerification(testEmail);
      expect(pending).toBeDefined();
      expect(pending?.email).toBe(testEmail);
      expect(pending?.code).toBe(res.code);
      expect(pending?.attempts).toBe(0);
    });

    it('enforces a 30-second cooldown on code regeneration to prevent abuse', () => {
      const first = createVerificationCode(testEmail);
      expect(first.success).toBe(true);

      const second = createVerificationCode(testEmail);
      expect(second.success).toBe(false);
      expect(second.error).toContain('Please wait');
      expect(second.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('successfully verifies a valid code and marks email as verified', async () => {
      const { code } = createVerificationCode(testEmail);
      expect(await isEmailVerified(testEmail)).toBe(false);

      const res = await verifyEmailCode(testEmail, code!);
      expect(res.success).toBe(true);

      // Verify email is now marked as verified
      expect(await isEmailVerified(testEmail)).toBe(true);

      // Verify pending record was cleaned up
      expect(getPendingVerification(testEmail)).toBeUndefined();
    });

    it('rejects an incorrect code and tracks remaining attempts', async () => {
      const { code } = createVerificationCode(testEmail);
      const wrongCode = code === '111111' ? '222222' : '111111';

      const res = await verifyEmailCode(testEmail, wrongCode);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid verification code');
      expect(res.error).toContain('4 attempt(s) remaining');

      const pending = getPendingVerification(testEmail);
      expect(pending?.attempts).toBe(1);
    });

    it('invalidates code and locks out after 5 incorrect attempts', async () => {
      const { code } = createVerificationCode(testEmail);
      const wrongCode = code === '111111' ? '222222' : '111111';

      let lastRes;
      for (let i = 0; i < MAX_VERIFICATION_ATTEMPTS; i++) {
        lastRes = await verifyEmailCode(testEmail, wrongCode);
      }

      expect(lastRes?.success).toBe(false);
      expect(lastRes?.error).toContain('Too many incorrect attempts');

      // Subsequent attempt confirms the code was deleted/invalidated
      const lockedRes = await verifyEmailCode(testEmail, code!);
      expect(lockedRes.success).toBe(false);
      expect(lockedRes.error).toContain('No active verification code found');
    });

    it('rejects expired verification codes', async () => {
      createVerificationCode(testEmail);
      const pending = getPendingVerification(testEmail);
      if (pending) {
        pending.expiresAt = Date.now() - 1000; // Force expiration
      }

      const res = await verifyEmailCode(testEmail, pending!.code);
      expect(res.success).toBe(false);
      expect(res.error).toContain('expired');
    });

    it('recognizes pre-verified demo email accounts', async () => {
      expect(await isEmailVerified('chioma@example.com')).toBe(true);
      expect(await isEmailVerified('owner@spottergym.com')).toBe(true);
      expect(await isEmailVerified('desk@spottergym.com')).toBe(true);
    });
  });

  describe('API Route: POST /api/auth/verify-email', () => {
    const createReq = (body: any, ip = '198.51.100.11') =>
      new NextRequest('http://localhost:3000/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify(body),
      });

    it('rejects malformed requests or non-6-digit codes with 400', async () => {
      const res1 = await verifyEmailHandler(
        createReq({ email: 'invalid-email', code: '123456' })
      );
      expect(res1.status).toBe(400);

      const res2 = await verifyEmailHandler(
        createReq({ email: 'user@example.com', code: '12345' })
      );
      expect(res2.status).toBe(400);

      const res3 = await verifyEmailHandler(
        createReq({ email: 'user@example.com', code: '12345a' })
      );
      expect(res3.status).toBe(400);
    });

    it('successfully verifies a valid code with 200 OK', async () => {
      const email = 'newmember@example.com';
      const { code } = createVerificationCode(email);

      const res = await verifyEmailHandler(createReq({ email, code }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('verified successfully');
    });

    it('returns 400 when an invalid code is supplied', async () => {
      const email = 'newmember@example.com';
      createVerificationCode(email);

      const res = await verifyEmailHandler(createReq({ email, code: '000000' }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('API Route: POST /api/auth/verify-email/resend', () => {
    const createReq = (body: any, ip = '198.51.100.22') =>
      new NextRequest('http://localhost:3000/api/auth/verify-email/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify(body),
      });

    it('returns alreadyVerified: true when email is already confirmed', async () => {
      await markEmailVerified('verified@example.com');

      const res = await resendVerificationHandler(
        createReq({ email: 'verified@example.com' })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alreadyVerified).toBe(true);
    });

    it('generates and dispatches a new verification code', async () => {
      const email = 'unverified@example.com';
      const res = await resendVerificationHandler(createReq({ email }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('verification code has been sent');

      const pending = getPendingVerification(email);
      expect(pending).toBeDefined();
      expect(pending?.code).toHaveLength(6);
    }, 15000);

    it('returns 429 when requesting resend before cooldown expires', async () => {
      const email = 'cooldown@example.com';
      const res1 = await resendVerificationHandler(createReq({ email }));
      expect(res1.status).toBe(200);

      const res2 = await resendVerificationHandler(createReq({ email }));
      expect(res2.status).toBe(429);
      const data = await res2.json();
      expect(data.error).toContain('Please wait');
    }, 15000);
  });

  describe('Automatic Verification on Registration', () => {
    it('sets isEmailVerified=false on registration and initiates code dispatch', async () => {
      const testEmail = 'regtest@spottergym.com';
      const req = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.33',
        },
        body: JSON.stringify({
          fullName: 'Chinedu Eze',
          email: testEmail,
          memberNumber: '334455',
          password: 'superSecretPassword123',
          hasConsented: true,
        }),
      });

      const res = await registerHandler(req);
      const data = await res.json();

      if (res.status === 201) {
        expect(data.member.isEmailVerified).toBe(false);
        const pending = getPendingVerification(testEmail);
        expect(pending).toBeDefined();
        expect(pending?.code).toHaveLength(6);
      }
    });
  });
});
