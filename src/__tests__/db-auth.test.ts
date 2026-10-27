import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/auth-security';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { prisma } from '../lib/prisma';
import { NextRequest } from 'next/server';
import { resetRateLimitStore } from '../lib/rate-limit';

describe('Database Authentication & Security Pipeline', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });
  beforeAll(async () => {
    try {
      await prisma.consentRecord.deleteMany({
        where: { member: { memberNumber: '998877' } },
      });
      await prisma.member.deleteMany({
        where: { memberNumber: '998877' },
      });
    } catch {}
  });

  afterAll(async () => {
    try {
      await prisma.consentRecord.deleteMany({
        where: { member: { memberNumber: '998877' } },
      });
      await prisma.member.deleteMany({
        where: { memberNumber: '998877' },
      });
    } catch {}
  });
  describe('Password Hashing & Constant-Time Verification', () => {
    it('generates secure salted hashes that differ across invocations', () => {
      const password = 'mySecretPassword123';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(hash1).toContain(':');
      expect(hash2).toContain(':');
    });

    it('verifies correct passwords and rejects incorrect passwords', () => {
      const password = 'correctHorseBatteryStaple';
      const hash = hashPassword(password);

      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword('wrongPassword', hash)).toBe(false);
      expect(verifyPassword('', hash)).toBe(false);
      expect(verifyPassword(password, 'invalid:malformed:hash')).toBe(false);
    });
  });

  describe('POST /api/auth/register Validation', () => {
    const createReq = (body: any) =>
      new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('rejects empty or single-word full names', async () => {
      const res1 = await registerHandler(
        createReq({
          fullName: 'SingleName',
          email: 'user@example.com',
          memberNumber: '123456',
          password: 'password123',
          hasConsented: true,
        })
      );
      const data1 = await res1.json();
      expect(res1.status).toBe(400);
      expect(data1.error).toContain('Please enter at least 2 words');

      const res2 = await registerHandler(
        createReq({
          fullName: '  ',
          email: 'user@example.com',
          memberNumber: '123456',
          password: 'password123',
          hasConsented: true,
        })
      );
      expect(res2.status).toBe(400);
    });

    it('rejects invalid email addresses', async () => {
      const res = await registerHandler(
        createReq({
          fullName: 'Chioma Adeyemi',
          email: 'not-an-email',
          memberNumber: '123456',
          password: 'password123',
          hasConsented: true,
        })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain('valid email address');
    });

    it('rejects non-6-digit member numbers', async () => {
      const resShort = await registerHandler(
        createReq({
          fullName: 'Chioma Adeyemi',
          email: 'chioma@example.com',
          memberNumber: '12345',
          password: 'password123',
          hasConsented: true,
        })
      );
      const dataShort = await resShort.json();
      expect(resShort.status).toBe(400);
      expect(dataShort.error).toContain('exactly 6 digits');

      const resAlpha = await registerHandler(
        createReq({
          fullName: 'Chioma Adeyemi',
          email: 'chioma@example.com',
          memberNumber: '12345a',
          password: 'password123',
          hasConsented: true,
        })
      );
      expect(resAlpha.status).toBe(400);
    });

    it('rejects passwords shorter than 8 characters', async () => {
      const res = await registerHandler(
        createReq({
          fullName: 'Chioma Adeyemi',
          email: 'chioma@example.com',
          memberNumber: '123456',
          password: 'short',
          hasConsented: true,
        })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain('at least 8 characters');
    });

    it('requires explicit NDPA consent', async () => {
      const res = await registerHandler(
        createReq({
          fullName: 'Chioma Adeyemi',
          email: 'chioma@example.com',
          memberNumber: '123456',
          password: 'password123',
          hasConsented: false,
        })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain('accept the check-in history');
    });

    it('successfully persists a new member into the database', async () => {
      const testMemberNum = '998877';
      const testEmail = 'realmember@spottergym.com';

      const res = await registerHandler(
        createReq({
          fullName: 'Olumide Bakare',
          email: testEmail,
          memberNumber: testMemberNum,
          password: 'superSecretPassword123',
          hasConsented: true,
        })
      );

      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.member).toBeDefined();
      expect(data.member.fullName).toBe('Olumide Bakare');
      expect(data.member.email).toBe(testEmail);
      expect(data.member.memberNumber).toBe(testMemberNum);
      expect(data.member.tier).toBe('PREMIUM');
      expect(data.member.id).toBeDefined();
    });

    it('rejects duplicate member number or email with 409 Conflict', async () => {
      const res = await registerHandler(
        createReq({
          fullName: 'Another Member',
          email: 'realmember@spottergym.com',
          memberNumber: '998877',
          password: 'anotherPassword123',
          hasConsented: true,
        })
      );

      const data = await res.json();
      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login Validation & Credential Handling', () => {
    const createReq = (body: any) =>
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('rejects missing identifier or password', async () => {
      const res = await loginHandler(createReq({ identifier: '', password: '' }));
      expect(res.status).toBe(400);
    });

    it('authenticates Owner credentials directly', async () => {
      const res = await loginHandler(
        createReq({
          identifier: 'owner@spottergym.com',
          password: 'ownerpassword',
        })
      );
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.type).toBe('staff');
      expect(data.user.staff.role).toBe('OWNER');
    });

    it('authenticates Desk Staff credentials directly', async () => {
      const res = await loginHandler(
        createReq({
          identifier: 'desk@spottergym.com',
          password: 'deskpassword',
        })
      );
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.type).toBe('staff');
      expect(data.user.staff.role).toBe('STAFF');
    });

    it('authenticates demo member Chioma Adeyemi credentials', async () => {
      const res = await loginHandler(
        createReq({
          identifier: '1042',
          password: 'password123',
        })
      );
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.type).toBe('member');
      expect(data.user.member.fullName).toBe('Chioma Adeyemi');
    });

    it('authenticates a registered member using database scrypt password verification', async () => {
      // Login by memberNumber
      const resByNum = await loginHandler(
        createReq({
          identifier: '998877',
          password: 'superSecretPassword123',
        })
      );
      const dataByNum = await resByNum.json();
      expect(resByNum.status).toBe(200);
      expect(dataByNum.success).toBe(true);
      expect(dataByNum.user.type).toBe('member');
      expect(dataByNum.user.member.fullName).toBe('Olumide Bakare');

      // Login by email
      const resByEmail = await loginHandler(
        createReq({
          identifier: 'realmember@spottergym.com',
          password: 'superSecretPassword123',
        })
      );
      const dataByEmail = await resByEmail.json();
      expect(resByEmail.status).toBe(200);
      expect(dataByEmail.success).toBe(true);

      // Rejects wrong password
      const resWrong = await loginHandler(
        createReq({
          identifier: '998877',
          password: 'wrongPasswordAttempt',
        })
      );
      expect(resWrong.status).toBe(401);
    });
  });
});
