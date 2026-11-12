import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';
import {
  koboToNaira,
  nairaToKobo,
  formatNaira,
  formatDateSpelledOut,
  calculateExtendedExpiry,
  generateReceipt,
  initializeFlutterwavePayment,
  fulfillSuccessfulPayment,
  parseJourneyEvents,
  processFlutterwaveWebhook,
  SUBSCRIPTION_FEES_KOBO,
} from '../lib/payment';
import { POST as initializeHandler } from '../app/api/payment/initialize/route';
import { POST as journeyHandler } from '../app/api/payment/journey/route';
import { POST as verifyHandler } from '../app/api/payment/verify/route';
import { POST as webhookHandler } from '../app/api/payment/webhook/route';
import { POST as simulateWebhookHandler } from '../app/api/payment/webhook/simulate/route';
import { GET as statusHandler } from '../app/api/payment/status/route';
import { resetRateLimitStore } from '../lib/rate-limit';

describe('Spotter Payment Pipeline & Flutterwave Integration', () => {
  const testMemberNumber = '889900';
  const testEmail = 'payment.test.member@example.com';
  let testMemberId: string;
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    // Clean up any stale records
    try {
      const existing = await prisma.member.findUnique({
        where: { memberNumber: testMemberNumber },
      });
      if (existing) {
        await prisma.paymentAttempt.deleteMany({
          where: { paymentLog: { memberId: existing.id } },
        });
        await prisma.expiryChange.deleteMany({
          where: { memberId: existing.id },
        });
        await prisma.paymentLog.deleteMany({
          where: { memberId: existing.id },
        });
        await prisma.member.delete({
          where: { id: existing.id },
        });
      }
    } catch {}

    // Create a temporary test member
    const member = await prisma.member.create({
      data: {
        fullName: 'Babatunde Fashola',
        email: testEmail,
        memberNumber: testMemberNumber,
        tier: 'BASIC',
        status: 'ACTIVE',
        expiryDate: new Date('2026-12-01T12:00:00Z'),
        openingBalanceKobo: 0,
      },
    });
    testMemberId = member.id;
  });

  beforeEach(() => {
    resetRateLimitStore();
  });

  afterAll(async () => {
    // Ensure clean teardown per rule: never pollute the database
    if (testMemberId) {
      try {
        await prisma.paymentAttempt.deleteMany({
          where: { paymentLog: { memberId: testMemberId } },
        });
        await prisma.expiryChange.deleteMany({
          where: { memberId: testMemberId },
        });
        await prisma.paymentLog.deleteMany({
          where: { memberId: testMemberId },
        });
        await prisma.member.delete({
          where: { id: testMemberId },
        });
      } catch (err) {
        console.error('Error during payment test teardown:', err);
      }
    }
  });

  describe('Currency & Wording Utilities (payments.md & decisions.md D12)', () => {
    it('converts kobo to naira and naira to kobo accurately without precision loss', () => {
      expect(koboToNaira(1500000)).toBe(15000);
      expect(koboToNaira(2500000)).toBe(25000);
      expect(nairaToKobo(15000)).toBe(1500000);
      expect(nairaToKobo(25000)).toBe(2500000);
    });

    it('formats naira amounts with thousands comma and the word naira (D12: 15,000 naira)', () => {
      expect(formatNaira(15000)).toBe('15,000 naira');
      expect(formatNaira(25000)).toBe('25,000 naira');
      expect(formatNaira(0)).toBe('0 naira');
    });

    it('formats dates with the month spelled out (D12: 2 August 2026)', () => {
      const date = new Date('2026-08-02T12:00:00Z');
      expect(formatDateSpelledOut(date)).toContain('August 2026');
      expect(formatDateSpelledOut(date)).toContain('2');
    });

    it('extends expiry by 30 days from the later of today and current expiry', () => {
      const futureDate = new Date('2026-12-01T00:00:00Z');
      const newExpiry = calculateExtendedExpiry(futureDate);
      const expectedTime = futureDate.getTime() + 30 * 24 * 60 * 60 * 1000;
      expect(newExpiry.getTime()).toBe(expectedTime);
    });
  });

  describe('Server-Side Fee Enforcement & Idempotency (payments.md)', () => {
    it('derives amount strictly on the server: Basic = 15,000 naira, Premium = 25,000 naira, Diamond = 45,000 naira', async () => {
      const basicInit = await initializeFlutterwavePayment({
        memberId: testMemberId,
        purpose: 'RENEWAL',
        tier: 'BASIC',
      });

      expect(basicInit.amountNaira).toBe(15000);
      expect(basicInit.amountKobo).toBe(SUBSCRIPTION_FEES_KOBO.BASIC);
      expect(SUBSCRIPTION_FEES_KOBO.PREMIUM).toBe(2500000);
      expect(SUBSCRIPTION_FEES_KOBO.DIAMOND).toBe(4500000);
      if (basicInit.paymentId) createdPaymentIds.push(basicInit.paymentId);
    });

    it('enforces 30-minute repeat tap lock: returns waiting payment notice when open payment exists', async () => {
      const secondTap = await initializeFlutterwavePayment({
        memberId: testMemberId,
        purpose: 'RENEWAL',
      });

      expect(secondTap.isWaiting).toBe(true);
      expect(secondTap.message).toContain('A payment is waiting. Do not pay again.');
    });
  });

  describe('Payment API Endpoints Integration', () => {
    it('POST /api/payment/initialize enforces 30-minute repeat tap protection via HTTP 409', async () => {
      const req = new NextRequest('http://localhost:3000/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: testMemberId,
          purpose: 'RENEWAL',
        }),
      });

      const res = await initializeHandler(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.isWaiting).toBe(true);
      expect(data.message).toContain('A payment is waiting. Do not pay again.');
    });

    it('GET /api/payment/status returns member tier, live expiry and waiting payment state', async () => {
      const req = new NextRequest(`http://localhost:3000/api/payment/status?memberId=${testMemberId}`, {
        method: 'GET',
      });

      const res = await statusHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.member.memberNumber).toBe(testMemberNumber);
      expect(data.hasWaitingPayment).toBe(true);
      expect(data.pricing.BASIC).toBe(15000);
      expect(data.pricing.PREMIUM).toBe(25000);
      expect(data.pricing.DIAMOND).toBe(45000);
    });

    it('GET /api/payment/status returns isNewMember=true and expiryFormatted="Not Subscribed" for members with no payments', async () => {
      const newMemberNumber = '998877';
      const newMember = await prisma.member.create({
        data: {
          fullName: 'New Member Test',
          email: 'new.member.test@example.com',
          memberNumber: newMemberNumber,
          tier: 'BASIC',
          status: 'ACTIVE',
          expiryDate: new Date(),
          openingBalanceKobo: 0,
        },
      });

      try {
        const req = new NextRequest(`http://localhost:3000/api/payment/status?memberId=${newMember.id}`, {
          method: 'GET',
        });

        const res = await statusHandler(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.member.isNewMember).toBe(true);
        expect(data.member.hasActiveSubscription).toBe(false);
        expect(data.member.isExpired).toBe(false);
        expect(data.member.expiryFormatted).toBe('Not Subscribed');
      } finally {
        await prisma.member.delete({
          where: { id: newMember.id },
        });
      }
    });

    it('POST /api/payment/verify marks payment PENDING and returns status message when returned from gateway', async () => {
      const openPayment = await prisma.paymentLog.findFirst({
        where: { memberId: testMemberId, status: 'INITIATED' },
      });

      if (openPayment?.gatewayRef) {
        const req = new NextRequest('http://localhost:3000/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: openPayment.gatewayRef,
          }),
        });

        const res = await verifyHandler(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.verified).toBe(false);
        expect(data.status).toBe('PENDING');
        expect(data.message).toContain('Checking your payment');
      }
    });
  });

  describe('Webhook Security & Transaction Fulfillment (payments.md & records.md)', () => {
    it('rejects webhook with mismatched amount (payments.md line 20)', async () => {
      const openPayment = await prisma.paymentLog.findFirst({
        where: { memberId: testMemberId },
      });

      if (openPayment?.gatewayRef) {
        const req = new NextRequest('http://localhost:3000/api/payment/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'charge.completed',
            data: {
              id: 9991234,
              tx_ref: openPayment.gatewayRef,
              amount: 5000, // Deliberately wrong amount (expected 15000)
              currency: 'NGN',
              status: 'successful',
            },
          }),
        });

        const res = await webhookHandler(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('Amount mismatch detected');
      }
    });

    it('fulfills successful payment atomically: updates SUCCESS, extends expiry, and logs ExpiryChange', async () => {
      const openPayment = await prisma.paymentLog.findFirst({
        where: { memberId: testMemberId },
      });

      if (openPayment?.gatewayRef) {
        const fulfillment = await fulfillSuccessfulPayment(openPayment.gatewayRef, 'FLW_MOCK_12345');
        expect(fulfillment.payment.status).toBe('SUCCESS');
        expect(fulfillment.member.status).toBe('ACTIVE');

        // Verify ExpiryChange row created
        const expiryChange = await prisma.expiryChange.findFirst({
          where: { memberId: testMemberId, source: 'GATEWAY' },
        });
        expect(expiryChange).toBeDefined();
        expect(expiryChange?.source).toBe('GATEWAY');

        // Repeated fulfillment does not duplicate (idempotency)
        const repeated = await fulfillSuccessfulPayment(openPayment.gatewayRef, 'FLW_MOCK_12345');
        expect(repeated.alreadyProcessed).toBe(true);
      }
    });

    it('generates a compliant official text receipt (payments.md line 35)', async () => {
      const settledPayment = await prisma.paymentLog.findFirst({
        where: { memberId: testMemberId, status: 'SUCCESS' },
        include: { member: true },
      });

      if (settledPayment) {
        const receipt = generateReceipt(settledPayment);
        expect(receipt.gymName).toBe('Spotter Gym');
        expect(receipt.memberName).toBe('Babatunde Fashola');
        expect(receipt.memberNumber).toBe(`#${testMemberNumber}`);
        expect(receipt.amountNaira).toBe('15,000 naira');
        expect(receipt.method).toBe('Flutterwave');
        expect(receipt.status).toBe('SUCCESS');
        expect(receipt.reference).toBe(settledPayment.gatewayRef);
      }
    });
  });

  describe('Database-Only Member Session Guard', () => {
    it('removes client-side demo fallbacks and guards /api/payment/status calls on unauthenticated sessions', () => {
      const authContextSource = fs.readFileSync(
        path.resolve(__dirname, '../context/AuthContext.tsx'),
        'utf8'
      );
      const memberAppSource = fs.readFileSync(
        path.resolve(__dirname, '../components/member/MemberApp.tsx'),
        'utf8'
      );
      const paymentModalSource = fs.readFileSync(
        path.resolve(__dirname, '../components/payment/PaymentModal.tsx'),
        'utf8'
      );

      expect(authContextSource).not.toContain('DEMO_MEMBER');
      expect(authContextSource).not.toContain('isClientDemoMemberId');
      expect(memberAppSource).not.toContain('DEMO_MEMBER');
      expect(memberAppSource).toContain('if (!memberId)');
      expect(paymentModalSource).not.toContain('isClientDemoMemberId');
      expect(paymentModalSource).toContain('!member.id');
    });
  });

  describe('PaymentLog Journey & Verification Source of Truth', () => {
    const cleanMemberAndPaymentLogs = async (memberNumber: string) => {
      const existing = await prisma.member.findUnique({ where: { memberNumber } });
      if (!existing) return;
      await prisma.paymentAttempt.deleteMany({
        where: { paymentLog: { memberId: existing.id } },
      });
      await prisma.expiryChange.deleteMany({ where: { memberId: existing.id } });
      await prisma.paymentLog.deleteMany({ where: { memberId: existing.id } });
      await prisma.member.delete({ where: { id: existing.id } });
    };

    it('tracks full user journey stages from MODAL_OPENED -> PLAN_SELECTED -> ABANDONED_MODAL and through VERIFIED_SUCCESS', async () => {
      const journeyMemberNum = '889901';
      await cleanMemberAndPaymentLogs(journeyMemberNum);

      const member = await prisma.member.create({
        data: {
          fullName: 'Journey Tracker',
          email: 'journey.tracker@example.com',
          memberNumber: journeyMemberNum,
          tier: 'BASIC',
          status: 'ACTIVE',
          expiryDate: new Date('2026-12-01T12:00:00Z'),
          openingBalanceKobo: 0,
        },
      });

      try {
        // 1) Abandonment branch: MODAL_OPENED -> PLAN_SELECTED(DIAMOND) -> ABANDONED_MODAL
        const openRes = await journeyHandler(
          new NextRequest('http://localhost:3000/api/payment/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'MODAL_OPENED',
              memberId: member.id,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'BASIC',
            }),
          })
        );
        expect(openRes.status).toBe(200);
        const openData = await openRes.json();
        expect(openData.paymentLogId).toBeTruthy();
        expect(openData.status).toBe('STARTED');

        const planRes = await journeyHandler(
          new NextRequest('http://localhost:3000/api/payment/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'PLAN_SELECTED',
              memberId: member.id,
              paymentLogId: openData.paymentLogId,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'DIAMOND',
            }),
          })
        );
        expect(planRes.status).toBe(200);

        const abandonRes = await journeyHandler(
          new NextRequest('http://localhost:3000/api/payment/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'ABANDONED_MODAL',
              memberId: member.id,
              paymentLogId: openData.paymentLogId,
              reason: 'User closed checkout modal',
            }),
          })
        );
        expect(abandonRes.status).toBe(200);
        const abandonData = await abandonRes.json();
        expect(abandonData.status).toBe('ABANDONED');
        expect(abandonData.stage).toBe('ABANDONED_MODAL');

        const abandonedLog = await prisma.paymentLog.findUnique({
          where: { id: openData.paymentLogId },
        });
        expect(abandonedLog?.status).toBe('ABANDONED');
        expect(abandonedLog?.tier).toBe('DIAMOND');
        expect(abandonedLog?.amountKobo).toBe(SUBSCRIPTION_FEES_KOBO.DIAMOND);
        expect(parseJourneyEvents(abandonedLog?.journeyEvents).map((e) => e.stage)).toEqual([
          'MODAL_OPENED',
          'PLAN_SELECTED',
          'ABANDONED_MODAL',
        ]);

        // 2) Full checkout branch: MODAL_OPENED -> PLAN_SELECTED(PREMIUM) -> INITIALIZE -> GATEWAY_REDIRECT -> RETURNED_FROM_GATEWAY -> WEBHOOK -> VERIFIED_SUCCESS
        const openRes2 = await journeyHandler(
          new NextRequest('http://localhost:3000/api/payment/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'MODAL_OPENED',
              memberId: member.id,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'BASIC',
            }),
          })
        );
        const { paymentLogId: checkoutLogId } = await openRes2.json();

        await journeyHandler(
          new NextRequest('http://localhost:3000/api/payment/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'PLAN_SELECTED',
              memberId: member.id,
              paymentLogId: checkoutLogId,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'PREMIUM',
            }),
          })
        );

        const initRes = await initializeHandler(
          new NextRequest('http://localhost:3000/api/payment/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              paymentLogId: checkoutLogId,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'PREMIUM',
            }),
          })
        );
        expect(initRes.status).toBe(200);
        const initData = await initRes.json();
        expect(initData.paymentLogId).toBe(checkoutLogId);
        expect(initData.amountNaira).toBe(25000);

        const redirectRes = await journeyHandler(
          new NextRequest('http://localhost:3000/api/payment/journey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'GATEWAY_REDIRECT',
              memberId: member.id,
              paymentLogId: checkoutLogId,
              reference: initData.reference,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'PREMIUM',
            }),
          })
        );
        expect(redirectRes.status).toBe(200);

        const returnRes = await verifyHandler(
          new NextRequest('http://localhost:3000/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: initData.reference,
              gatewayStatus: 'successful',
              transactionId: 'FLW_JOURNEY_TX_1',
            }),
          })
        );
        expect(returnRes.status).toBe(200);
        const returnData = await returnRes.json();
        expect(returnData.verified).toBe(false);
        expect(returnData.status).toBe('PENDING');

        const webhookRes = await webhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.FLUTTERWAVE_WEBHOOK_HASH
                ? { 'verif-hash': process.env.FLUTTERWAVE_WEBHOOK_HASH }
                : {}),
            },
            body: JSON.stringify({
              event: 'charge.completed',
              data: {
                id: 'FLW_JOURNEY_TX_1',
                tx_ref: initData.reference,
                amount: 25000,
                currency: 'NGN',
                status: 'successful',
              },
            }),
          })
        );
        expect(webhookRes.status).toBe(200);

        const settledLog = await prisma.paymentLog.findUnique({
          where: { id: checkoutLogId },
          include: { attempts: true },
        });
        expect(settledLog?.status).toBe('SUCCESS');
        expect(settledLog?.currentStage).toBe('VERIFIED_SUCCESS');
        expect(settledLog?.verifiedSource).toBe('WEBHOOK');
        expect(settledLog?.verifiedAt).not.toBeNull();
        expect(settledLog?.gatewayTxId).toBe('FLW_JOURNEY_TX_1');

        const stages = parseJourneyEvents(settledLog?.journeyEvents).map((e) => e.stage);
        expect(stages).toEqual([
          'MODAL_OPENED',
          'PLAN_SELECTED',
          'INITIATED',
          'GATEWAY_REDIRECT',
          'RETURNED_FROM_GATEWAY',
          'WEBHOOK_RECEIVED',
          'VERIFIED_SUCCESS',
        ]);
        expect(settledLog?.attempts.length).toBeGreaterThanOrEqual(2);
      } finally {
        await cleanMemberAndPaymentLogs(journeyMemberNum);
      }
    });

    it('uses PaymentLog as single source of truth: excludes unverified logs from verified status and official receipts', async () => {
      const truthMemberNum = '889902';
      await cleanMemberAndPaymentLogs(truthMemberNum);

      const member = await prisma.member.create({
        data: {
          fullName: 'Truth Verifier',
          email: 'truth.verifier@example.com',
          memberNumber: truthMemberNum,
          tier: 'BASIC',
          status: 'ACTIVE',
          expiryDate: new Date(),
          openingBalanceKobo: 0,
        },
      });

      try {
        // Initialize a payment (only INITIATED, not settled)
        const initRes = await initializeHandler(
          new NextRequest('http://localhost:3000/api/payment/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'DIAMOND',
            }),
          })
        );
        expect(initRes.status).toBe(200);
        const initData = await initRes.json();

        // Client verify call before PaymentLog settles MUST return verified: false
        const unverifiedRes = await verifyHandler(
          new NextRequest('http://localhost:3000/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: initData.reference }),
          })
        );
        expect(unverifiedRes.status).toBe(200);
        const unverifiedData = await unverifiedRes.json();
        expect(unverifiedData.verified).toBe(false);
        expect(unverifiedData.status).toBe('PENDING');
        expect(unverifiedData.receipt).toBeUndefined();

        // Status endpoint must keep isNewMember=true and emit 0 official receipts for non-SUCCESS PaymentLogs
        const pendingStatusRes = await statusHandler(
          new NextRequest(`http://localhost:3000/api/payment/status?memberId=${member.id}`)
        );
        expect(pendingStatusRes.status).toBe(200);
        const pendingStatusData = await pendingStatusRes.json();
        expect(pendingStatusData.member.isNewMember).toBe(true);
        expect(pendingStatusData.member.verifiedPaymentsCount).toBe(0);
        expect(pendingStatusData.receipts).toHaveLength(0);
        expect(pendingStatusData.hasWaitingPayment).toBe(true);

        // Settle PaymentLog via authoritative fulfillment
        await fulfillSuccessfulPayment(initData.reference, 'FLW_TRUTH_TX_1', 'WEBHOOK');

        const verifiedRes = await verifyHandler(
          new NextRequest('http://localhost:3000/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: initData.reference, simulateSuccess: false }),
          })
        );
        expect(verifiedRes.status).toBe(200);
        const verifiedData = await verifiedRes.json();
        expect(verifiedData.verified).toBe(true);
        expect(verifiedData.status).toBe('SUCCESS');
        expect(verifiedData.verifiedSource).toBe('WEBHOOK');
        expect(verifiedData.receipt?.reference).toBe(initData.reference);

        const settledStatusRes = await statusHandler(
          new NextRequest(`http://localhost:3000/api/payment/status?memberId=${member.id}`)
        );
        expect(settledStatusRes.status).toBe(200);
        const settledStatusData = await settledStatusRes.json();
        expect(settledStatusData.member.isNewMember).toBe(false);
        expect(settledStatusData.member.verifiedPaymentsCount).toBe(1);
        expect(settledStatusData.member.tier).toBe('DIAMOND');
        expect(settledStatusData.hasWaitingPayment).toBe(false);
        expect(settledStatusData.receipts).toHaveLength(1);
        expect(settledStatusData.receipts[0].reference).toBe(initData.reference);
      } finally {
        await cleanMemberAndPaymentLogs(truthMemberNum);
      }
    });

    it('returns 404 for unknown memberId and 400 for malformed JSON without throwing 500 errors', async () => {
      const missingRes = await initializeHandler(
        new NextRequest('http://localhost:3000/api/payment/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: 'nonexistent-member-id-check',
            purpose: 'RENEWAL',
          }),
        })
      );
      expect(missingRes.status).toBe(404);

      const badJsonHeaders = { 'Content-Type': 'application/json' };
      const initBad = await initializeHandler(
        new NextRequest('http://localhost:3000/api/payment/initialize', {
          method: 'POST',
          headers: badJsonHeaders,
          body: '{invalid-json',
        })
      );
      const journeyBad = await journeyHandler(
        new NextRequest('http://localhost:3000/api/payment/journey', {
          method: 'POST',
          headers: badJsonHeaders,
          body: '{invalid-json',
        })
      );
      const verifyBad = await verifyHandler(
        new NextRequest('http://localhost:3000/api/payment/verify', {
          method: 'POST',
          headers: badJsonHeaders,
          body: '{invalid-json',
        })
      );

      expect(initBad.status).toBe(400);
      expect(journeyBad.status).toBe(400);
      expect(verifyBad.status).toBe(400);
    });

    it('enforces constant-time verif-hash webhook signature, production fail-closed 503, currency NGN, and webhook idempotency', async () => {
      const sigMemberNum = '889903';
      await cleanMemberAndPaymentLogs(sigMemberNum);

      const initialExpiry = new Date('2026-08-01T12:00:00Z');
      const member = await prisma.member.create({
        data: {
          fullName: 'Webhook Sig Member',
          email: 'webhook.sig@example.com',
          memberNumber: sigMemberNum,
          tier: 'BASIC',
          status: 'ACTIVE',
          expiryDate: initialExpiry,
          openingBalanceKobo: 0,
        },
      });

      try {
        vi.stubEnv('FLUTTERWAVE_SECRET_KEY', '');
        const initRes = await initializeHandler(
          new NextRequest('http://localhost:3000/api/payment/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              purpose: 'RENEWAL',
              tier: 'PREMIUM',
            }),
          })
        );
        expect(initRes.status).toBe(200);
        const initData = await initRes.json();
        const txRef = initData.reference as string;

        // 1. Fail closed (503) in production if webhook secret is missing
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('FLUTTERWAVE_WEBHOOK_SECRET', '');
        vi.stubEnv('FLUTTERWAVE_WEBHOOK_HASH', '');
        const unconfiguredRes = await webhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'charge.completed',
              data: {
                id: 551100,
                tx_ref: txRef,
                amount: 25000,
                currency: 'NGN',
                status: 'successful',
              },
            }),
          })
        );
        expect(unconfiguredRes.status).toBe(503);

        // 2. Reject invalid / wrong-length verif-hash with 401
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('FLUTTERWAVE_WEBHOOK_SECRET', 'spotter_secret_hash_2026');

        const wrongSigRes = await webhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'verif-hash': 'wrong-short',
            },
            body: JSON.stringify({
              event: 'charge.completed',
              data: {
                id: 551100,
                tx_ref: txRef,
                amount: 25000,
                currency: 'NGN',
                status: 'successful',
              },
            }),
          })
        );
        expect(wrongSigRes.status).toBe(401);

        // 3. Reject USD currency mismatch (400) even with valid verif-hash and matching numeric amount
        const badCurrencyRes = await webhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'verif-hash': 'spotter_secret_hash_2026',
            },
            body: JSON.stringify({
              event: 'charge.completed',
              data: {
                id: 551100,
                tx_ref: txRef,
                amount: 25000,
                currency: 'USD',
                status: 'successful',
              },
            }),
          })
        );
        expect(badCurrencyRes.status).toBe(400);
        const badCurrencyData = await badCurrencyRes.json();
        expect(badCurrencyData.error).toContain('Currency mismatch detected');

        const midLog = await prisma.paymentLog.findUnique({
          where: { gatewayRef: txRef },
          include: { attempts: true },
        });
        expect(midLog?.status).toBe('INITIATED');
        expect(midLog?.attempts.some((a) => a.stage === 'WEBHOOK_AMOUNT_MISMATCH')).toBe(
          true
        );

        // 4. Valid NGN webhook with matching verif-hash fulfills payment once
        const validPayload = JSON.stringify({
          event: 'charge.completed',
          data: {
            id: 551100,
            tx_ref: txRef,
            amount: 25000,
            currency: 'NGN',
            status: 'successful',
          },
        });
        const firstOkRes = await webhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'verif-hash': 'spotter_secret_hash_2026',
            },
            body: validPayload,
          })
        );
        expect(firstOkRes.status).toBe(200);
        const firstOkData = await firstOkRes.json();
        expect(firstOkData.verifiedSource).toBe('WEBHOOK');
        expect(firstOkData.status).toBe('SUCCESS');
        expect(firstOkData.alreadyProcessed).toBe(false);

        const afterFirstMember = await prisma.member.findUnique({
          where: { id: member.id },
        });
        expect(afterFirstMember?.tier).toBe('PREMIUM');

        // 5. Repeated identical webhook is strictly idempotent and never double-extends expiry
        const repeatOkRes = await webhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'verif-hash': 'spotter_secret_hash_2026',
            },
            body: validPayload,
          })
        );
        expect(repeatOkRes.status).toBe(200);
        const repeatOkData = await repeatOkRes.json();
        expect(repeatOkData.alreadyProcessed).toBe(true);

        const afterRepeatMember = await prisma.member.findUnique({
          where: { id: member.id },
        });
        expect(afterRepeatMember?.expiryDate.toISOString()).toBe(
          afterFirstMember?.expiryDate.toISOString()
        );
      } finally {
        vi.unstubAllEnvs();
        await cleanMemberAndPaymentLogs(sigMemberNum);
      }
    });

    it('never settles /api/payment/verify from browser return flags or simulateSuccess until webhook confirms PaymentLog', async () => {
      const noTrustMemberNum = '889904';
      await cleanMemberAndPaymentLogs(noTrustMemberNum);

      const member = await prisma.member.create({
        data: {
          fullName: 'Browser NonTrust Member',
          email: 'browser.nontrust@example.com',
          memberNumber: noTrustMemberNum,
          tier: 'BASIC',
          status: 'ACTIVE',
          expiryDate: new Date('2026-09-01T12:00:00Z'),
          openingBalanceKobo: 0,
        },
      });

      try {
        vi.stubEnv('FLUTTERWAVE_SECRET_KEY', '');
        const initRes = await initializeHandler(
          new NextRequest('http://localhost:3000/api/payment/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'BASIC',
            }),
          })
        );
        const initData = await initRes.json();
        const txRef = initData.reference as string;

        // Browser return params claiming successful + legacy simulateSuccess flag must be ignored
        const verifyReturnRes = await verifyHandler(
          new NextRequest('http://localhost:3000/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: txRef,
              gatewayStatus: 'successful',
              transactionId: 'SPOOFED_TX_123',
              isSandbox: true,
              simulateSuccess: true,
            }),
          })
        );
        expect(verifyReturnRes.status).toBe(200);
        const verifyReturnData = await verifyReturnRes.json();
        expect(verifyReturnData.status).toBe('PENDING');
        expect(verifyReturnData.verified).toBe(false);

        const pendingLog = await prisma.paymentLog.findUnique({
          where: { gatewayRef: txRef },
          include: { attempts: true },
        });
        expect(pendingLog?.status).toBe('PENDING');
        const attemptsBeforePoll = pendingLog?.attempts.length ?? 0;

        // Polling with poll=true stays PENDING and avoids spamming VERIFY_CHECKED rows
        const pollRes = await verifyHandler(
          new NextRequest('http://localhost:3000/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: txRef,
              poll: true,
            }),
          })
        );
        expect(pollRes.status).toBe(200);
        const pollData = await pollRes.json();
        expect(pollData.status).toBe('PENDING');
        expect(pollData.verified).toBe(false);

        const afterPollLog = await prisma.paymentLog.findUnique({
          where: { gatewayRef: txRef },
          include: { attempts: true },
        });
        expect(afterPollLog?.attempts.length).toBe(attemptsBeforePoll);

        // Wrong member cannot trigger simulate webhook
        const wrongOwnerSimRes = await simulateWebhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: txRef,
              memberId: 'wrong-member-id',
              gatewayStatus: 'successful',
            }),
          })
        );
        expect(wrongOwnerSimRes.status).toBe(403);

        // Dev simulated webhook settles PaymentLog via WEBHOOK source of truth
        const simRes = await simulateWebhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: txRef,
              memberId: member.id,
              gatewayStatus: 'successful',
            }),
          })
        );
        expect(simRes.status).toBe(200);
        const simData = await simRes.json();
        expect(simData.success).toBe(true);
        expect(simData.status).toBe('SUCCESS');
        expect(simData.verifiedSource).toBe('WEBHOOK');

        const settledLog = await prisma.paymentLog.findUnique({
          where: { gatewayRef: txRef },
          include: { attempts: true },
        });
        expect(settledLog?.status).toBe('SUCCESS');
        expect(settledLog?.verifiedSource).toBe('WEBHOOK');
        expect(settledLog?.attempts.some((a) => a.stage === 'WEBHOOK_RECEIVED')).toBe(
          true
        );
        expect(settledLog?.attempts.some((a) => a.stage === 'VERIFIED_SUCCESS')).toBe(
          true
        );

        // Live key blocks dev webhook simulation endpoint with 403
        vi.stubEnv('FLUTTERWAVE_SECRET_KEY', 'FLWSECK_TEST_BLOCK_SIMULATE');
        const blockedSimRes = await simulateWebhookHandler(
          new NextRequest('http://localhost:3000/api/payment/webhook/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: txRef,
              memberId: member.id,
              gatewayStatus: 'successful',
            }),
          })
        );
        expect(blockedSimRes.status).toBe(403);
      } finally {
        vi.unstubAllEnvs();
        await cleanMemberAndPaymentLogs(noTrustMemberNum);
      }
    });

    it('cross-verifies live numeric flwId via Flutterwave /v3/transactions/{id}/verify and rejects spoofed responses', async () => {
      const liveVerifyMemberNum = '889905';
      await cleanMemberAndPaymentLogs(liveVerifyMemberNum);

      const member = await prisma.member.create({
        data: {
          fullName: 'Live Remote Verify Member',
          email: 'live.verify@example.com',
          memberNumber: liveVerifyMemberNum,
          tier: 'BASIC',
          status: 'ACTIVE',
          expiryDate: new Date('2026-09-15T12:00:00Z'),
          openingBalanceKobo: 0,
        },
      });

      try {
        vi.stubEnv('FLUTTERWAVE_SECRET_KEY', '');
        const initRes = await initializeHandler(
          new NextRequest('http://localhost:3000/api/payment/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              purpose: 'RENEWAL',
              tier: 'BASIC',
            }),
          })
        );
        const initData = await initRes.json();
        const txRef = initData.reference as string;

        vi.stubEnv('FLUTTERWAVE_SECRET_KEY', 'FLWSECK_TEST_LIVE_VERIFY_KEY');

        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        // 1. Spoofed webhook where Flutterwave verify endpoint disagrees (returns failed)
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              status: 'success',
              data: {
                id: 778899,
                tx_ref: txRef,
                amount: 15000,
                currency: 'NGN',
                status: 'failed',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );

        const rejectedRes = await processFlutterwaveWebhook({
          event: 'charge.completed',
          data: {
            id: 778899,
            tx_ref: txRef,
            amount: 15000,
            currency: 'NGN',
            status: 'successful',
          },
          skipRemoteVerify: false,
        });
        expect(rejectedRes.httpStatus).toBe(400);
        expect(fetchSpy).toHaveBeenCalledWith(
          'https://api.flutterwave.com/v3/transactions/778899/verify',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer FLWSECK_TEST_LIVE_VERIFY_KEY',
            }),
          })
        );

        const stillPendingLog = await prisma.paymentLog.findUnique({
          where: { gatewayRef: txRef },
          include: { attempts: true },
        });
        expect(stillPendingLog?.status).toBe('INITIATED');
        expect(
          stillPendingLog?.attempts.some((a) => a.stage === 'WEBHOOK_REMOTE_MISMATCH')
        ).toBe(true);

        // 2. Genuine webhook where Flutterwave /v3/transactions/778899/verify confirms success
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              status: 'success',
              data: {
                id: 778899,
                tx_ref: txRef,
                amount: 15000,
                currency: 'NGN',
                status: 'successful',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );

        const confirmedRes = await processFlutterwaveWebhook({
          event: 'charge.completed',
          data: {
            id: 778899,
            tx_ref: txRef,
            amount: 15000,
            currency: 'NGN',
            status: 'successful',
          },
          skipRemoteVerify: false,
        });
        expect(confirmedRes.httpStatus).toBe(200);
        expect(confirmedRes.body.status).toBe('SUCCESS');
        expect(confirmedRes.body.verifiedSource).toBe('WEBHOOK');
      } finally {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        await cleanMemberAndPaymentLogs(liveVerifyMemberNum);
      }
    });

    it('normalizes redirectUrl so passing /member does not duplicate /member/member', async () => {
      const redirectMemberNum = '889906';
      await cleanMemberAndPaymentLogs(redirectMemberNum);

      const member = await prisma.member.create({
        data: {
          fullName: 'Redirect Normalize Member',
          email: 'redirect.norm@example.com',
          memberNumber: redirectMemberNum,
          tier: 'BASIC',
          status: 'ACTIVE',
          expiryDate: new Date('2026-10-01T12:00:00Z'),
          openingBalanceKobo: 0,
        },
      });

      try {
        vi.stubEnv('FLUTTERWAVE_SECRET_KEY', 'FLWSECK_TEST_REDIRECT_NORM');
        let capturedRedirectUrl = '';

        vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
          async (_url, init) => {
            const parsedBody = JSON.parse(String(init?.body || '{}'));
            capturedRedirectUrl = parsedBody.redirect_url || '';
            return new Response(
              JSON.stringify({
                status: 'success',
                data: {
                  link: 'https://checkout.flutterwave.com/v3/hosted/pay/mock-norm',
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        );

        const initRes = await initializeHandler(
          new NextRequest('http://localhost:3000/api/payment/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              purpose: 'NEW_SUBSCRIPTION',
              tier: 'BASIC',
              redirectUrl: 'http://localhost:3000/member',
            }),
          })
        );
        expect(initRes.status).toBe(200);
        expect(capturedRedirectUrl).toContain(
          'http://localhost:3000/member?payment_status=returned&tx_ref='
        );
        expect(capturedRedirectUrl).not.toContain('/member/member');
      } finally {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        await cleanMemberAndPaymentLogs(redirectMemberNum);
      }
    });
  });
});

