import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateRandom6DigitNumber,
  formatMemberNumberDisplay,
  isValidMemberNumber,
} from '../lib/member-number';
import {
  generateMemberNumberSchema,
  normalizePhoneNumber,
} from '../lib/validations/receptionist';
import {
  createStaffToken,
  verifyStaffToken,
  authenticateStaffRequest,
  VERIFIED_STAFF_ACCOUNTS,
} from '../lib/staff-auth';
import { POST as generateMemberNumberHandler } from '../app/api/receptionist/generate-member-number/route';
import { POST as checkPhoneHandler } from '../app/api/receptionist/check-phone/route';
import { GET as recentIssuancesHandler } from '../app/api/receptionist/recent-issuances/route';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { prisma } from '../lib/prisma';
import { resetRateLimitStore } from '../lib/rate-limit';

describe('Receptionist Dashboard & Member Number Generation Pipeline', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  describe('Cryptographic Member Number Generation & Formatting', () => {
    it('generates a 6-digit member number within [100000, 999999]', () => {
      for (let i = 0; i < 20; i++) {
        const num = generateRandom6DigitNumber();
        expect(num).toHaveLength(6);
        expect(/^\d{6}$/.test(num)).toBe(true);
        const parsed = parseInt(num, 10);
        expect(parsed).toBeGreaterThanOrEqual(100000);
        expect(parsed).toBeLessThan(1000000);
      }
    });

    it('generates non-deterministic, high-entropy numbers on subsequent invocations', () => {
      const generated = new Set<string>();
      for (let i = 0; i < 30; i++) {
        generated.add(generateRandom6DigitNumber());
      }
      // With CSPRNG randomInt in 900,000 range, 30 samples should all be unique
      expect(generated.size).toBe(30);
    });

    it('formats a 6-digit member number for high legibility display', () => {
      expect(formatMemberNumberDisplay('481920')).toBe('481 920');
      expect(formatMemberNumberDisplay('102938')).toBe('102 938');
      expect(formatMemberNumberDisplay('123')).toBe('123');
    });

    it('correctly validates 6-digit format', () => {
      expect(isValidMemberNumber('104200')).toBe(true);
      expect(isValidMemberNumber('999999')).toBe(true);
      expect(isValidMemberNumber('1042')).toBe(false);
      expect(isValidMemberNumber('abcdef')).toBe(false);
      expect(isValidMemberNumber('1234567')).toBe(false);
    });
  });

  describe('Receptionist Input Validation & Nigerian Phone Normalization', () => {
    it('normalizes local 11-digit Nigerian mobile numbers to international format', () => {
      expect(normalizePhoneNumber('08031234567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('07019876543')).toBe('+2347019876543');
      expect(normalizePhoneNumber('+2348031234567')).toBe('+2348031234567');
      expect(normalizePhoneNumber('0803-123-4567')).toBe('+2348031234567');
    });

    it('accepts valid intending member registration data', () => {
      const input = {
        fullName: 'Amina Olanrewaju',
        phone: '08023456789',
        tier: 'PREMIUM',
        email: 'amina@example.com',
        initialPaymentKobo: 2500000,
        paymentMethod: 'CASH',
        notes: 'Walked in with friend',
      };

      const result = generateMemberNumberSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe('Amina Olanrewaju');
        expect(result.data.phone).toBe('+2348023456789');
        expect(result.data.tier).toBe('PREMIUM');
        expect(result.data.initialPaymentKobo).toBe(2500000);
      }
    });

    it('rejects names with less than 2 words to prevent incomplete records', () => {
      const input = {
        fullName: 'Amina',
        phone: '08023456789',
        tier: 'BASIC',
      };

      const result = generateMemberNumberSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 2 words or names');
      }
    });

    it('rejects invalid tiers', () => {
      const input = {
        fullName: 'Amina Olanrewaju',
        phone: '08023456789',
        tier: 'VIP_PLATINUM',
      };

      const result = generateMemberNumberSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects negative initial payments', () => {
      const input = {
        fullName: 'Amina Olanrewaju',
        phone: '08023456789',
        tier: 'BASIC',
        initialPaymentKobo: -5000,
      };

      const result = generateMemberNumberSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Staff Authentication & Strict Permission Security (RBAC)', () => {
    it('creates and verifies cryptographically signed staff tokens', () => {
      const staff = VERIFIED_STAFF_ACCOUNTS['staff_desk_01'];
      const token = createStaffToken(staff);
      expect(token).toBeDefined();
      expect(token.includes('.')).toBe(true);

      const verified = verifyStaffToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe('staff_desk_01');
      expect(verified?.role).toBe('STAFF');
      expect(verified?.email).toBe('desk@spottergym.com');
    });

    it('rejects tampered or forged staff tokens', () => {
      const staff = VERIFIED_STAFF_ACCOUNTS['staff_desk_01'];
      const token = createStaffToken(staff);
      const tampered = token.slice(0, -4) + 'abcd';
      const verified = verifyStaffToken(tampered);
      expect(verified).toBeNull();
    });

    it('strictly denies member accounts with 403 Forbidden when accessing receptionist endpoints', async () => {
      const req = new NextRequest('http://localhost:3000/api/receptionist/generate-member-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-type': 'member',
          'x-member-id': 'mem_1042',
        },
        body: JSON.stringify({
          fullName: 'Chidi Okonkwo',
          phone: '08091112233',
          tier: 'BASIC',
        }),
      });

      const res = await generateMemberNumberHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Staff permission required');
    });

    it('denies unauthenticated requests with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/receptionist/generate-member-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Chidi Okonkwo',
          phone: '08091112233',
          tier: 'BASIC',
        }),
      });

      const res = await generateMemberNumberHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('Receptionist API: Member Number Generation, Check & Retrieval', () => {
    it('successfully generates and returns a 6-digit member number for an authorized staff member', async () => {
      const uniquePhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
      const uniqueEmail = `fatima_${Date.now()}_${Math.floor(Math.random() * 10000)}@spottergym.com`;
      const req = new NextRequest('http://localhost:3000/api/receptionist/generate-member-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-id': 'staff_desk_01',
          'x-staff-email': 'desk@spottergym.com',
          'x-staff-role': 'STAFF',
        },
        body: JSON.stringify({
          fullName: 'Fatima Dangote',
          phone: uniquePhone,
          tier: 'PREMIUM',
          email: uniqueEmail,
          initialPaymentKobo: 2500000,
          paymentMethod: 'POS',
          notes: 'Issued at desk by Chioma',
        }),
      });

      const res = await generateMemberNumberHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.memberNumber).toHaveLength(6);
      expect(data.member.fullName).toBe('Fatima Dangote');
      expect(data.member.tier).toBe('PREMIUM');
      expect(data.member.isClaimed).toBe(false);
      expect(data.member.issuedBy.id).toBe('staff_desk_01');
    });

    it('prevents duplicate registration when phone number is already registered', async () => {
      // 1. Generate first member
      const duplicatePhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
      const req1 = new NextRequest('http://localhost:3000/api/receptionist/generate-member-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-id': 'staff_desk_01',
          'x-staff-email': 'desk@spottergym.com',
          'x-staff-role': 'STAFF',
        },
        body: JSON.stringify({
          fullName: 'Emeka Junior',
          phone: duplicatePhone,
          tier: 'BASIC',
        }),
      });

      const res1 = await generateMemberNumberHandler(req1);
      expect(res1.status).toBe(201);

      // 2. Attempt duplicate with identical phone
      const req2 = new NextRequest('http://localhost:3000/api/receptionist/generate-member-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-id': 'staff_desk_01',
          'x-staff-email': 'desk@spottergym.com',
          'x-staff-role': 'STAFF',
        },
        body: JSON.stringify({
          fullName: 'Another Person',
          phone: duplicatePhone,
          tier: 'BASIC',
        }),
      });

      const res2 = await generateMemberNumberHandler(req2);
      expect(res2.status).toBe(409);
      const data2 = await res2.json();
      expect(data2.success).toBe(false);
      expect(data2.error).toContain('already registered');
    });

    it('POST /api/receptionist/check-phone allows the receptionist to verify visitor status before generating', async () => {
      const checkReq = new NextRequest('http://localhost:3000/api/receptionist/check-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-id': 'staff_desk_01',
          'x-staff-email': 'desk@spottergym.com',
        },
        body: JSON.stringify({ phone: '+2348000000000' }),
      });

      const res = await checkPhoneHandler(checkReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.exists).toBe('boolean');
    });

    it('GET /api/receptionist/recent-issuances returns shift audit history to authorized staff', async () => {
      const req = new NextRequest('http://localhost:3000/api/receptionist/recent-issuances', {
        method: 'GET',
        headers: {
          'x-staff-id': 'staff_desk_01',
          'x-staff-email': 'desk@spottergym.com',
          'x-staff-role': 'STAFF',
        },
      });

      const res = await recentIssuancesHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.issuances)).toBe(true);
    });
  });

  describe('End-to-End Workflow: Front-Desk Number Generation to Member Portal Claim', () => {
    it('intending member gets 6-digit number at desk, then successfully claims and activates their account on /api/auth/register', async () => {
      // 1. Receptionist generates member number for intending member
      const claimPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
      const claimEmail = `claim_${Date.now()}_${Math.floor(Math.random() * 10000)}@spottergym.com`;

      const deskReq = new NextRequest('http://localhost:3000/api/receptionist/generate-member-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-id': 'staff_desk_01',
          'x-staff-email': 'desk@spottergym.com',
          'x-staff-role': 'STAFF',
        },
        body: JSON.stringify({
          fullName: 'Kelechi Iheanacho',
          phone: claimPhone,
          email: claimEmail,
          tier: 'PREMIUM',
        }),
      });

      const deskRes = await generateMemberNumberHandler(deskReq);
      expect(deskRes.status).toBe(201);
      const deskData = await deskRes.json();
      const generatedNumber = deskData.memberNumber;
      expect(generatedNumber).toHaveLength(6);

      // 2. Member arrives home, visits /auth, enters their generated 6-digit member number and sets password
      const memberReq = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Kelechi Iheanacho',
          email: claimEmail,
          memberNumber: generatedNumber,
          password: 'securememberpassword123',
          hasConsented: true,
        }),
      });

      const memberRes = await registerHandler(memberReq);
      expect(memberRes.status).toBe(201);
      const memberData = await memberRes.json();
      expect(memberData.success).toBe(true);
      expect(memberData.member.memberNumber).toBe(generatedNumber);
      expect(memberData.member.fullName).toBe('Kelechi Iheanacho');
      expect(memberData.member.tier).toBe('PREMIUM');
    });
  });
});
