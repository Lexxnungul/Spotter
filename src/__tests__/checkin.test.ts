import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';
import {
  CHECKIN_CODE_EXPIRY_MS,
  createCheckInCode,
  lookupCheckInCode,
  markCheckInCodeUsed,
  resetCheckInCodeStore,
} from '../lib/checkin-codes';
import {
  createMemberToken,
  MEMBER_COOKIE_NAME,
} from '../lib/member-auth';
import { resetRateLimitStore } from '../lib/rate-limit';
import { resetEmailTransporter } from '../lib/email';
import {
  createCheckInQrPayload,
  parseCheckInQrPayload,
} from '../lib/checkin-qr';
import { POST as generateHandler } from '../app/api/checkin/generate/route';
import { GET as statusHandler } from '../app/api/checkin/status/route';
import { POST as verifyHandler } from '../app/api/checkin/verify/route';

describe('One-tap member check-in code system', () => {
  const memberNumber = '776655';
  const testEmail = 'checkin.test.member@example.com';
  const fullName = 'Test Checkin Member';
  let memberId = '';
  let token = '';
  let requestCounter = 0;

  beforeAll(async () => {
    const existing = await prisma.member.findUnique({ where: { memberNumber } });
    if (existing) {
      await prisma.attendance.deleteMany({ where: { memberId: existing.id } });
      await prisma.member.delete({ where: { id: existing.id } });
    }

    const member = await prisma.member.create({
      data: {
        fullName,
        email: testEmail,
        memberNumber,
        tier: 'BASIC',
        status: 'ACTIVE',
        expiryDate: new Date('2026-12-01T12:00:00Z'),
        openingBalanceKobo: 0,
      },
    });
    memberId = member.id;
    token = createMemberToken({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      memberNumber: member.memberNumber,
    });
  });

  beforeEach(async () => {
    resetRateLimitStore();
    resetCheckInCodeStore();
    resetEmailTransporter();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    await prisma.attendance.deleteMany({ where: { memberId } });
  });

  afterAll(async () => {
    if (memberId) {
      await prisma.attendance.deleteMany({ where: { memberId } });
      await prisma.member.delete({ where: { id: memberId } });
    }
    resetEmailTransporter();
  });

  const authenticatedRequest = () => {
    requestCounter += 1;
    const request = new NextRequest('http://localhost:3000/api/checkin/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `10.1.1.${requestCounter}`,
      },
    });
    request.cookies.set(MEMBER_COOKIE_NAME, token);
    return request;
  };

  const verifyRequest = (code: string) => {
    requestCounter += 1;
    return new NextRequest('http://localhost:3000/api/checkin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `10.2.2.${requestCounter}`,
      },
      body: JSON.stringify({ code }),
    });
  };

  it('generates a 6-digit code that expires after 10 minutes and becomes unusable once consumed', () => {
    const created = createCheckInCode({ memberId, fullName, email: testEmail });

    expect(created.code).toMatch(/^\d{6}$/);
    expect(created.expiresAt.getTime() - created.createdAt.getTime()).toBe(CHECKIN_CODE_EXPIRY_MS);
    const lookup = lookupCheckInCode(created.code);
    expect(lookup.status).toBe('valid');

    if (lookup.status === 'valid') {
      markCheckInCodeUsed(lookup.codeHash);
    }
    expect(lookupCheckInCode(created.code).status).toBe('used');
  });

  it('generates a code from the dashboard and emails the date and time', async () => {
    const response = await generateHandler(authenticatedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.code).toMatch(/^\d{6}$/);
    expect(new Date(data.expiresAt).getTime() - new Date(data.generatedAt).getTime()).toBe(
      CHECKIN_CODE_EXPIRY_MS
    );
    expect(data.emailedTo).toBe(testEmail);
  });

  it('verifies a code, records one attendance row, and rejects the used code', async () => {
    const generated = await generateHandler(authenticatedRequest());
    const generatedData = await generated.json();

    const verified = await verifyHandler(verifyRequest(generatedData.code));
    const verifiedData = await verified.json();

    expect(verified.status).toBe(200);
    expect(verifiedData.success).toBe(true);
    expect(verifiedData.alreadyCheckedIn).toBe(false);
    expect(verifiedData.daysTrained).toBe(1);

    const attendance = await prisma.attendance.findMany({ where: { memberId } });
    expect(attendance).toHaveLength(1);
    expect(attendance[0].source).toBe('APP');

    const replay = await verifyHandler(verifyRequest(generatedData.code));
    const replayData = await replay.json();
    expect(replay.status).toBe(400);
    expect(replayData.success).toBe(false);
    expect(attendance).toHaveLength(1);
  });

  it('does not create a second attendance row for the same Lagos day', async () => {
    const first = await generateHandler(authenticatedRequest());
    const firstData = await first.json();
    await verifyHandler(verifyRequest(firstData.code));

    const second = await generateHandler(authenticatedRequest());
    const secondData = await second.json();

    expect(secondData.alreadyCheckedIn).toBe(true);
    expect(secondData.daysTrained).toBe(1);

    const status = await statusHandler(authenticatedRequest());
    const statusData = await status.json();
    expect(statusData.checkedInToday).toBe(true);
    expect(statusData.daysTrained).toBe(1);
    expect(await prisma.attendance.count({ where: { memberId } })).toBe(1);
  });

  it('verifies a check-in using a code parsed from a QR payload', async () => {
    const generated = await generateHandler(authenticatedRequest());
    const generatedData = await generated.json();
    const parsed = parseCheckInQrPayload(createCheckInQrPayload(generatedData.code));

    expect(parsed).toBe(generatedData.code);
    if (!parsed) throw new Error('QR payload did not contain a valid code.');

    const verified = await verifyHandler(verifyRequest(parsed));
    const verifiedData = await verified.json();

    expect(verified.status).toBe(200);
    expect(verifiedData.success).toBe(true);
    expect(verifiedData.daysTrained).toBe(1);
  });
});

describe('Check-in QR payload parsing', () => {
  it('wraps and unwraps the priority 6-digit code', () => {
    expect(createCheckInQrPayload('123456')).toBe('SPOTTER_CHECKIN:123456');
    expect(parseCheckInQrPayload('SPOTTER_CHECKIN:123456')).toBe('123456');
  });

  it('accepts raw 6-digit codes and simulator links', () => {
    expect(parseCheckInQrPayload('654321')).toBe('654321');
    expect(parseCheckInQrPayload('http://localhost:3000/spotter/checkin?code=456789')).toBe('456789');
  });

  it('rejects invalid QR payloads', () => {
    expect(parseCheckInQrPayload('SPOTTER_CHECKIN:12ab56')).toBeNull();
    expect(parseCheckInQrPayload('not-a-check-in-code')).toBeNull();
  });
});
