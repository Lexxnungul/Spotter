import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const SUBSCRIPTION_FEES_KOBO = {
  BASIC: 1500000, // 15,000 naira
  PREMIUM: 2500000, // 25,000 naira
  DIAMOND: 4500000, // 45,000 naira
} as const;

export const SUBSCRIPTION_FEES_NAIRA = {
  BASIC: 15000,
  PREMIUM: 25000,
  DIAMOND: 45000,
} as const;

export type PaymentTier = 'BASIC' | 'PREMIUM' | 'DIAMOND';
export type PaymentPurpose = 'NEW_SUBSCRIPTION' | 'RENEWAL' | 'BALANCE';
export type PaymentLogStatus =
  | 'STARTED'
  | 'INITIATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ABANDONED';
export type PaymentJourneyStage =
  | 'MODAL_OPENED'
  | 'PLAN_SELECTED'
  | 'ABANDONED_MODAL'
  | 'INITIATED'
  | 'REPEAT_TAP_BLOCKED'
  | 'GATEWAY_REDIRECT'
  | 'RETURNED_FROM_GATEWAY'
  | 'VERIFY_CHECKED'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_AMOUNT_MISMATCH'
  | 'VERIFIED_SUCCESS'
  | 'FAILED'
  | 'DESK_RECORDED';
export type PaymentVerifiedSource =
  | 'WEBHOOK'
  | 'FLUTTERWAVE_VERIFY'
  | 'SANDBOX'
  | 'DESK';

export interface JourneyEventEntry {
  stage: PaymentJourneyStage;
  status: PaymentLogStatus;
  actor: string;
  detail: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Converts kobo integer to naira.
 */
export function koboToNaira(kobo: number): number {
  return Math.round(kobo / 100);
}

/**
 * Converts naira to kobo integer.
 */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Formats amount per decisions.md D12 (e.g. "15,000 naira").
 */
export function formatNaira(amountInNaira: number): string {
  return `${amountInNaira.toLocaleString('en-US')} naira`;
}

/**
 * Formats date with month spelled out per decisions.md D12 (e.g. "2 August 2026").
 */
export function formatDateSpelledOut(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Active';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Calculates new expiry date by extending 30 days from the later of today and current expiry
 * per records.md line 27.
 */
export function calculateExtendedExpiry(currentExpiryDate: Date | string): Date {
  const current =
    typeof currentExpiryDate === 'string'
      ? new Date(currentExpiryDate)
      : currentExpiryDate;
  const now = new Date();
  const baseDate = current > now ? current : now;
  return new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
}

/**
 * Safely parses ordered journeyEvents JSON stored on PaymentLog.
 */
export function parseJourneyEvents(raw?: string | null): JourneyEventEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JourneyEventEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Appends a structured step to a PaymentLog's ordered journeyEvents JSON array.
 */
export function appendJourneyEvent(
  existingRaw: string | null | undefined,
  entry: Omit<JourneyEventEntry, 'timestamp'> & { timestamp?: string }
): string {
  const events = parseJourneyEvents(existingRaw);
  events.push({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
  return JSON.stringify(events);
}

/**
 * Maps an amount in kobo back to a subscription tier for legacy/backfill fallbacks.
 */
export function inferTierFromAmountKobo(
  amountKobo: number,
  fallback: string = 'BASIC'
): PaymentTier {
  if (amountKobo >= SUBSCRIPTION_FEES_KOBO.DIAMOND) return 'DIAMOND';
  if (amountKobo >= SUBSCRIPTION_FEES_KOBO.PREMIUM) return 'PREMIUM';
  if (amountKobo >= SUBSCRIPTION_FEES_KOBO.BASIC) return 'BASIC';
  if (fallback === 'DIAMOND' || fallback === 'PREMIUM' || fallback === 'BASIC') {
    return fallback;
  }
  return 'BASIC';
}

/**
 * Computes authoritative server-side payment tier and amount in kobo.
 * Never trusts client-supplied amounts (payments.md line 13).
 */
export function resolveServerAmountKobo(params: {
  memberTier: string;
  openingBalanceKobo: number;
  purpose: PaymentPurpose;
  requestedTier?: PaymentTier;
  enforcePositiveBalance?: boolean;
}): { effectiveTier: PaymentTier; amountKobo: number; amountNaira: number } {
  const candidateTier = (params.requestedTier || params.memberTier || 'BASIC') as string;
  const effectiveTier: PaymentTier =
    candidateTier === 'DIAMOND' || candidateTier === 'PREMIUM' ? candidateTier : 'BASIC';

  if (params.purpose === 'BALANCE') {
    if (params.enforcePositiveBalance !== false && params.openingBalanceKobo <= 0) {
      throw new Error('You have no outstanding balance to pay.');
    }
    const amountKobo = Math.max(0, params.openingBalanceKobo);
    return {
      effectiveTier,
      amountKobo,
      amountNaira: koboToNaira(amountKobo),
    };
  }

  const amountKobo = SUBSCRIPTION_FEES_KOBO[effectiveTier];
  return {
    effectiveTier,
    amountKobo,
    amountNaira: koboToNaira(amountKobo),
  };
}

export function hasConfiguredLiveFlutterwaveKey(): boolean {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  return Boolean(
    secretKey &&
      secretKey.trim().length > 0 &&
      !secretKey.includes('placeholder')
  );
}

export function getFlutterwaveWebhookSecret(): string {
  return (
    process.env.FLUTTERWAVE_WEBHOOK_SECRET ||
    process.env.FLUTTERWAVE_WEBHOOK_HASH ||
    ''
  ).trim();
}

/**
 * Verifies Flutterwave's `verif-hash` signature using constant-time comparison.
 * Fails closed in production when the webhook secret env variable is missing.
 */
export function verifyFlutterwaveWebhookSignature(signatureHeader: string | null): {
  valid: boolean;
  misconfigured: boolean;
} {
  const secret = getFlutterwaveWebhookSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { valid: false, misconfigured: true };
    }
    return { valid: true, misconfigured: false };
  }

  if (!signatureHeader || !signatureHeader.trim()) {
    return { valid: false, misconfigured: false };
  }

  const expectedDigest = crypto.createHash('sha256').update(secret).digest();
  const receivedDigest = crypto
    .createHash('sha256')
    .update(signatureHeader.trim())
    .digest();

  return {
    valid: crypto.timingSafeEqual(expectedDigest, receivedDigest),
    misconfigured: false,
  };
}

/**
 * Checks if an open payment (INITIATED or PENDING) exists for this member in the last 30 minutes
 * per payments.md line 25. Draft checkout sessions (STARTED) do not lock Pay.
 */
export async function getOpenPaymentWithin30Minutes(
  memberId: string,
  purpose?: string
) {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  return prisma.paymentLog.findFirst({
    where: {
      memberId,
      ...(purpose ? { purpose } : {}),
      status: { in: ['INITIATED', 'PENDING'] },
      createdAt: { gte: thirtyMinutesAgo },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export interface ReceiptData {
  gymName: string;
  memberName: string;
  memberNumber: string;
  amountNaira: string;
  amountKobo: number;
  dateSpelledOut: string;
  method: string;
  reference: string;
  purpose: string;
  status: string;
  verifiedSource?: string | null;
  verifiedAt?: string | null;
}

/**
 * Generates structured receipt object from an authoritative PaymentLog row
 * conforming to payments.md line 35.
 */
export function generateReceipt(paymentLog: {
  gatewayRef: string | null;
  amountKobo: number;
  tier?: string | null;
  method: string;
  status: string;
  purpose: string;
  verifiedSource?: string | null;
  verifiedAt?: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  member: {
    fullName: string;
    memberNumber: string | null;
  };
}): ReceiptData {
  const paymentDate =
    paymentLog.verifiedAt || paymentLog.confirmedAt || paymentLog.createdAt;
  const naira = koboToNaira(paymentLog.amountKobo);
  const resolvedTier = inferTierFromAmountKobo(
    paymentLog.amountKobo,
    paymentLog.tier || 'BASIC'
  );

  let planLabel = 'Basic Plan';
  if (resolvedTier === 'DIAMOND' || paymentLog.amountKobo >= SUBSCRIPTION_FEES_KOBO.DIAMOND) {
    planLabel = 'Diamond Plan (VIP)';
  } else if (resolvedTier === 'PREMIUM' || paymentLog.amountKobo >= SUBSCRIPTION_FEES_KOBO.PREMIUM) {
    planLabel = 'Premium Plan';
  }

  let purposeDisplay = `Monthly Membership Renewal (${planLabel})`;
  if (paymentLog.purpose === 'NEW_SUBSCRIPTION') {
    purposeDisplay = `New Membership Plan Activation (${planLabel})`;
  } else if (paymentLog.purpose === 'BALANCE') {
    purposeDisplay = 'Account Balance Settlement';
  }

  return {
    gymName: 'Spotter Gym',
    memberName: paymentLog.member.fullName,
    memberNumber: paymentLog.member.memberNumber
      ? `#${paymentLog.member.memberNumber}`
      : 'Unassigned',
    amountNaira: formatNaira(naira),
    amountKobo: paymentLog.amountKobo,
    dateSpelledOut: formatDateSpelledOut(paymentDate),
    method: paymentLog.method === 'GATEWAY' ? 'Flutterwave' : paymentLog.method,
    reference: paymentLog.gatewayRef || 'SPT-LOCAL',
    purpose: purposeDisplay,
    status: paymentLog.status,
    verifiedSource: paymentLog.verifiedSource || null,
    verifiedAt: paymentLog.verifiedAt
      ? paymentLog.verifiedAt.toISOString()
      : null,
  };
}

/**
 * Appends a journey event and a corresponding PaymentAttempt row inside a caller-supplied transaction or Prisma client.
 */
async function appendStageWithAttempt(
  client: Prisma.TransactionClient | typeof prisma,
  paymentLog: {
    id: string;
    journeyEvents: string;
  },
  params: {
    stage: PaymentJourneyStage;
    status: PaymentLogStatus;
    actor: string;
    detail: string;
    metadata?: Record<string, unknown>;
    extraData?: Prisma.PaymentLogUpdateInput;
  }
) {
  const nextEvents = appendJourneyEvent(paymentLog.journeyEvents, {
    stage: params.stage,
    status: params.status,
    actor: params.actor,
    detail: params.detail,
    metadata: params.metadata,
  });

  const updated = await client.paymentLog.update({
    where: { id: paymentLog.id },
    data: {
      currentStage: params.stage,
      status: params.status,
      journeyEvents: nextEvents,
      ...params.extraData,
      attempts: {
        create: {
          stage: params.stage,
          status: params.status,
          detail: params.detail,
        },
      },
    },
  });

  return updated;
}

/**
 * Records front-end & pre-gateway checkout journey actions onto PaymentLog
 * (MODAL_OPENED, PLAN_SELECTED, ABANDONED_MODAL, GATEWAY_REDIRECT).
 */
export async function recordPaymentJourneyStep(params: {
  action: 'MODAL_OPENED' | 'PLAN_SELECTED' | 'ABANDONED_MODAL' | 'GATEWAY_REDIRECT';
  memberId: string;
  paymentLogId?: string;
  purpose?: PaymentPurpose;
  tier?: PaymentTier;
  reason?: string;
  reference?: string;
}) {
  const {
    action,
    memberId,
    paymentLogId,
    purpose = 'RENEWAL',
    tier,
    reason,
    reference,
  } = params;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    return { notFound: true as const };
  }

  const pricing = resolveServerAmountKobo({
    memberTier: member.tier,
    openingBalanceKobo: member.openingBalanceKobo,
    purpose,
    requestedTier: tier,
    enforcePositiveBalance: false,
  });

  if (action === 'MODAL_OPENED') {
    const existingOpen = await getOpenPaymentWithin30Minutes(memberId);
    if (existingOpen) {
      await appendStageWithAttempt(prisma, existingOpen, {
        stage: 'MODAL_OPENED',
        status: existingOpen.status as PaymentLogStatus,
        actor: 'member_ui',
        detail: `Reopened checkout modal while open transaction (${existingOpen.status}) is waiting`,
      });
      return {
        notFound: false as const,
        paymentLog: existingOpen,
        hasWaitingPayment: true,
      };
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existingDraft = await prisma.paymentLog.findFirst({
      where: {
        memberId,
        purpose,
        status: 'STARTED',
        createdAt: { gte: thirtyMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    const detail = `Opened payment modal (${purpose}) on ${pricing.effectiveTier} tier (${formatNaira(pricing.amountNaira)})`;

    if (existingDraft) {
      const updated = await appendStageWithAttempt(prisma, existingDraft, {
        stage: 'MODAL_OPENED',
        status: 'STARTED',
        actor: 'member_ui',
        detail,
        metadata: { tier: pricing.effectiveTier, purpose },
        extraData: {
          tier: pricing.effectiveTier,
          amountKobo: pricing.amountKobo,
        },
      });
      return { notFound: false as const, paymentLog: updated, hasWaitingPayment: false };
    }

    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const created = await prisma.paymentLog.create({
      data: {
        memberId: member.id,
        purpose,
        tier: pricing.effectiveTier,
        method: 'GATEWAY',
        amountKobo: pricing.amountKobo,
        status: 'STARTED',
        currentStage: 'MODAL_OPENED',
        journeyEvents: appendJourneyEvent('[]', {
          stage: 'MODAL_OPENED',
          status: 'STARTED',
          actor: 'member_ui',
          detail,
          metadata: { tier: pricing.effectiveTier, purpose },
        }),
        idempotencyKey: `JRN-${member.id}-${purpose}-${timestamp}-${randomSuffix}`,
        attempts: {
          create: {
            stage: 'MODAL_OPENED',
            status: 'STARTED',
            detail,
          },
        },
      },
    });

    return { notFound: false as const, paymentLog: created, hasWaitingPayment: false };
  }

  // Locate target PaymentLog owned strictly by memberId (access isolation)
  const targetLog = paymentLogId
    ? await prisma.paymentLog.findFirst({ where: { id: paymentLogId, memberId } })
    : reference
      ? await prisma.paymentLog.findFirst({ where: { gatewayRef: reference, memberId } })
      : null;

  if (action === 'PLAN_SELECTED') {
    const detail = `Selected ${pricing.effectiveTier} plan (${formatNaira(pricing.amountNaira)}) for ${purpose}`;

    if (targetLog && targetLog.status === 'STARTED') {
      const updated = await appendStageWithAttempt(prisma, targetLog, {
        stage: 'PLAN_SELECTED',
        status: 'STARTED',
        actor: 'member_ui',
        detail,
        metadata: {
          tier: pricing.effectiveTier,
          amountKobo: pricing.amountKobo,
          purpose,
        },
        extraData: {
          tier: pricing.effectiveTier,
          purpose,
          amountKobo: pricing.amountKobo,
        },
      });
      return { notFound: false as const, paymentLog: updated, hasWaitingPayment: false };
    }

    // If modal had no active STARTED row (or had previously abandoned), start a clean draft row
    if (!targetLog) {
      const timestamp = Date.now();
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      const created = await prisma.paymentLog.create({
        data: {
          memberId: member.id,
          purpose,
          tier: pricing.effectiveTier,
          method: 'GATEWAY',
          amountKobo: pricing.amountKobo,
          status: 'STARTED',
          currentStage: 'PLAN_SELECTED',
          journeyEvents: appendJourneyEvent('[]', {
            stage: 'PLAN_SELECTED',
            status: 'STARTED',
            actor: 'member_ui',
            detail,
            metadata: { tier: pricing.effectiveTier, purpose },
          }),
          idempotencyKey: `JRN-${member.id}-${purpose}-${timestamp}-${randomSuffix}`,
          attempts: {
            create: {
              stage: 'PLAN_SELECTED',
              status: 'STARTED',
              detail,
            },
          },
        },
      });
      return { notFound: false as const, paymentLog: created, hasWaitingPayment: false };
    }

    return { notFound: false as const, paymentLog: targetLog, hasWaitingPayment: false };
  }

  if (action === 'ABANDONED_MODAL') {
    if (!targetLog || targetLog.status !== 'STARTED') {
      return { notFound: false as const, paymentLog: targetLog, hasWaitingPayment: false };
    }

    const closeReason =
      reason || 'Member closed payment modal before proceeding to Flutterwave checkout';
    const updated = await appendStageWithAttempt(prisma, targetLog, {
      stage: 'ABANDONED_MODAL',
      status: 'ABANDONED',
      actor: 'member_ui',
      detail: closeReason,
      extraData: {
        failureReason: closeReason,
      },
    });
    return { notFound: false as const, paymentLog: updated, hasWaitingPayment: false };
  }

  // action === 'GATEWAY_REDIRECT'
  if (
    targetLog &&
    (targetLog.status === 'INITIATED' || targetLog.status === 'PENDING')
  ) {
    const updated = await appendStageWithAttempt(prisma, targetLog, {
      stage: 'GATEWAY_REDIRECT',
      status: targetLog.status as PaymentLogStatus,
      actor: 'member_ui',
      detail: 'Redirecting member browser to Flutterwave hosted checkout',
    });
    return { notFound: false as const, paymentLog: updated, hasWaitingPayment: false };
  }

  return { notFound: false as const, paymentLog: targetLog, hasWaitingPayment: false };
}

/**
 * Initializes a Flutterwave payment (or reuses an active STARTED checkout session in PaymentLog)
 * and persists the full initialization & redirect journey in PaymentLog.
 */
export async function initializeFlutterwavePayment(params: {
  memberId: string;
  purpose?: PaymentPurpose;
  tier?: PaymentTier;
  redirectUrl?: string;
  paymentLogId?: string;
}) {
  const { memberId, purpose = 'RENEWAL', tier, redirectUrl, paymentLogId } = params;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw new Error('Member record not found.');
  }

  // Repeat-tap protection against PaymentLog (payments.md lines 25-26)
  const existingOpenPayment = await getOpenPaymentWithin30Minutes(memberId);
  if (existingOpenPayment) {
    const elapsedMinutes = Math.floor(
      (Date.now() - existingOpenPayment.createdAt.getTime()) / 60000
    );
    const remainingMinutes = Math.max(1, 30 - elapsedMinutes);

    await appendStageWithAttempt(prisma, existingOpenPayment, {
      stage: 'REPEAT_TAP_BLOCKED',
      status: existingOpenPayment.status as PaymentLogStatus,
      actor: 'payment_initializer',
      detail: `Blocked duplicate pay attempt within 30-minute lock window (${remainingMinutes} min remaining)`,
      extraData: {
        // Keep current status untouched when blocked
        status: existingOpenPayment.status,
      },
    });

    return {
      isWaiting: true as const,
      message: `A payment is waiting. Do not pay again. Please wait ${remainingMinutes} minute(s) or complete the pending transaction.`,
      paymentLog: existingOpenPayment,
      payment: existingOpenPayment,
      paymentLogId: existingOpenPayment.id,
      paymentId: existingOpenPayment.id,
      reference: existingOpenPayment.gatewayRef,
    };
  }

  // Server-authoritative tier & kobo calculation
  const { effectiveTier, amountKobo, amountNaira } = resolveServerAmountKobo({
    memberTier: member.tier,
    openingBalanceKobo: member.openingBalanceKobo,
    purpose,
    requestedTier: tier,
  });

  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const gatewayRef = `SPT-${member.memberNumber || member.id.slice(-6)}-${timestamp}-${randomSuffix}`;
  const idempotencyKey = `IDEM-${member.id}-${purpose}-${timestamp}-${randomSuffix}`;
  const initDetail = `Initiated ${purpose} payment of ${formatNaira(amountNaira)} for ${effectiveTier} tier`;

  // Upgrade owned draft checkout row in PaymentLog when available, else create fresh PaymentLog
  const existingDraft = paymentLogId
    ? await prisma.paymentLog.findFirst({
        where: {
          id: paymentLogId,
          memberId: member.id,
          status: { in: ['STARTED', 'ABANDONED'] },
        },
      })
    : null;

  let paymentLog;
  if (existingDraft) {
    paymentLog = await appendStageWithAttempt(prisma, existingDraft, {
      stage: 'INITIATED',
      status: 'INITIATED',
      actor: 'payment_initializer',
      detail: initDetail,
      metadata: {
        tier: effectiveTier,
        purpose,
        amountKobo,
        gatewayRef,
      },
      extraData: {
        purpose,
        tier: effectiveTier,
        method: 'GATEWAY',
        amountKobo,
        idempotencyKey,
        gatewayRef,
        failureReason: null,
      },
    });
  } else {
    paymentLog = await prisma.paymentLog.create({
      data: {
        memberId: member.id,
        purpose,
        tier: effectiveTier,
        method: 'GATEWAY',
        amountKobo,
        status: 'INITIATED',
        currentStage: 'INITIATED',
        journeyEvents: appendJourneyEvent('[]', {
          stage: 'INITIATED',
          status: 'INITIATED',
          actor: 'payment_initializer',
          detail: initDetail,
          metadata: {
            tier: effectiveTier,
            purpose,
            amountKobo,
            gatewayRef,
          },
        }),
        idempotencyKey,
        gatewayRef,
        attempts: {
          create: {
            stage: 'INITIATED',
            status: 'INITIATED',
            detail: initDetail,
          },
        },
      },
    });
  }

  // Contact Flutterwave if live secret key is configured
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const rawBaseUrl =
    redirectUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const normalizedBaseUrl = rawBaseUrl
    .trim()
    .replace(/\/member(?:\?.*)?$/i, '')
    .replace(/\/$/, '');
  const returnUrl = `${normalizedBaseUrl}/member?payment_status=returned&tx_ref=${gatewayRef}`;

  if (hasConfiguredLiveFlutterwaveKey() && secretKey) {
    try {
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: gatewayRef,
          amount: amountNaira,
          currency: 'NGN',
          redirect_url: returnUrl,
          payment_options: 'card,banktransfer,ussd',
          meta: {
            memberId: member.id,
            paymentLogId: paymentLog.id,
            memberNumber: member.memberNumber,
            purpose,
            tier: effectiveTier,
          },
          customer: {
            email: member.email || `member_${member.memberNumber}@spottergym.com`,
            name: member.fullName,
            phonenumber: member.phone || '',
          },
          customizations: {
            title: 'Spotter Gym Subscription',
            description: `${effectiveTier} Membership (1 Month Renewal)`,
          },
        }),
      });

      const data = await response.json();
      if (data.status === 'success' && data.data?.link) {
        return {
          isWaiting: false as const,
          paymentLink: data.data.link as string,
          reference: gatewayRef,
          amountNaira,
          amountKobo,
          paymentLogId: paymentLog.id,
          paymentId: paymentLog.id,
        };
      }

      console.warn('[Flutterwave API non-success]:', data);
      await appendStageWithAttempt(prisma, paymentLog, {
        stage: 'FAILED',
        status: 'INITIATED',
        actor: 'flutterwave_api',
        detail: `Flutterwave init non-success (${data.message || 'unknown'}); falling back to sandbox flow`,
        extraData: {
          gatewayStatus: String(data.status || 'error'),
        },
      });
    } catch (err: any) {
      console.error('[Flutterwave API network error]:', err);
      await appendStageWithAttempt(prisma, paymentLog, {
        stage: 'FAILED',
        status: 'INITIATED',
        actor: 'flutterwave_api',
        detail: `Flutterwave network error (${err?.message || 'unreachable'}); using fallback flow`,
      });
    }
  }

  // Development sandbox fallback: UI handles sandbox webhook verification without redirecting externally
  const devCheckoutUrl = `${normalizedBaseUrl}/member?payment_status=sandbox_checkout&tx_ref=${gatewayRef}&amount=${amountNaira}`;

  return {
    isWaiting: false as const,
    paymentLink: devCheckoutUrl,
    reference: gatewayRef,
    amountNaira,
    amountKobo,
    paymentLogId: paymentLog.id,
    paymentId: paymentLog.id,
    isDevSandbox: true,
  };
}

/**
 * Authoritative verification check reading strictly from PaymentLog as the single source of truth.
 */
export async function verifyPaymentFromLog(txRef: string) {
  const paymentLog = await prisma.paymentLog.findUnique({
    where: { gatewayRef: txRef },
    include: {
      member: true,
      attempts: { orderBy: { at: 'asc' } },
    },
  });

  if (!paymentLog) {
    return { found: false as const, isVerified: false as const, paymentLog: null };
  }

  const isVerified =
    paymentLog.status === 'SUCCESS' &&
    Boolean(paymentLog.verifiedAt || paymentLog.confirmedAt);

  return {
    found: true as const,
    isVerified,
    paymentLog,
    journeyEvents: parseJourneyEvents(paymentLog.journeyEvents),
  };
}

/**
 * Completes a verified successful payment and extends expiry atomically in a single transaction,
 * recording authoritative verification truth in PaymentLog (payments.md line 22 & records.md line 27).
 */
export async function fulfillSuccessfulPayment(
  txRef: string,
  externalRef?: string,
  verifiedSource: PaymentVerifiedSource = 'WEBHOOK'
) {
  const paymentLog = await prisma.paymentLog.findUnique({
    where: { gatewayRef: txRef },
    include: { member: true },
  });

  if (!paymentLog) {
    throw new Error(`PaymentLog with reference ${txRef} not found.`);
  }

  // Idempotency: PaymentLog already verified as SUCCESS -> do nothing (payments.md line 21)
  if (paymentLog.status === 'SUCCESS') {
    return {
      alreadyProcessed: true,
      paymentLog,
      payment: paymentLog,
      member: paymentLog.member,
      newExpiry: paymentLog.member.expiryDate,
    };
  }

  const member = paymentLog.member;
  const currentExpiry = new Date(member.expiryDate);
  const newExpiry =
    paymentLog.purpose === 'BALANCE'
      ? currentExpiry
      : calculateExtendedExpiry(currentExpiry);

  const now = new Date();
  const targetTier = inferTierFromAmountKobo(
    paymentLog.amountKobo,
    paymentLog.tier || member.tier
  );

  const detail = externalRef
    ? `Verified via ${verifiedSource} (External Ref: ${externalRef})`
    : `Verified via ${verifiedSource}`;

  return prisma.$transaction(async (tx) => {
    // 1. Mark authoritative PaymentLog SUCCESS + VERIFIED_SUCCESS
    const updatedPaymentLog = await appendStageWithAttempt(tx, paymentLog, {
      stage: 'VERIFIED_SUCCESS',
      status: 'SUCCESS',
      actor: verifiedSource.toLowerCase(),
      detail,
      metadata: {
        verifiedSource,
        externalRef: externalRef || null,
        amountKobo: paymentLog.amountKobo,
        tier: targetTier,
      },
      extraData: {
        tier: paymentLog.purpose === 'BALANCE' ? paymentLog.tier : targetTier,
        gatewayTxId: externalRef || paymentLog.gatewayTxId,
        gatewayStatus: 'successful',
        verifiedSource,
        verifiedAt: now,
        confirmedAt: now,
        failureReason: null,
      },
    });

    // 2. Extend member expiry / tier or clear balance atomically
    const updatedMember = await tx.member.update({
      where: { id: member.id },
      data:
        paymentLog.purpose === 'BALANCE'
          ? {
              status: 'ACTIVE',
              openingBalanceKobo: Math.max(
                0,
                member.openingBalanceKobo - paymentLog.amountKobo
              ),
            }
          : {
              tier: targetTier,
              expiryDate: newExpiry,
              status: 'ACTIVE',
            },
    });

    // 3. Write ExpiryChange audit log for subscription renewals/activations (records.md line 26)
    if (paymentLog.purpose !== 'BALANCE') {
      await tx.expiryChange.create({
        data: {
          memberId: member.id,
          oldExpiry: currentExpiry,
          newExpiry,
          source: verifiedSource === 'DESK' ? 'DESK' : 'GATEWAY',
          actorId:
            verifiedSource === 'WEBHOOK'
              ? 'flutterwave_webhook'
              : verifiedSource.toLowerCase(),
        },
      });
    }

    return {
      alreadyProcessed: false,
      paymentLog: updatedPaymentLog,
      payment: updatedPaymentLog,
      member: updatedMember,
      newExpiry,
    };
  });
}

type FlutterwaveRemoteVerifyResult =
  | {
      available: false;
      ok: false;
      error: string;
    }
  | {
      available: true;
      ok: boolean;
      status?: string;
      txRef?: string;
      flwId?: string;
      amount?: number;
      currency?: string;
      rawData?: Record<string, unknown>;
      error?: string;
    };

async function queryFlutterwaveVerifyEndpoint(
  url: string
): Promise<FlutterwaveRemoteVerifyResult> {
  if (!hasConfiguredLiveFlutterwaveKey()) {
    return {
      available: false,
      ok: false,
      error: 'Live Flutterwave secret key is not configured.',
    };
  }

  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY!.trim();
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
    const payload = await res.json().catch(() => null);
    const data = payload?.data;

    if (!res.ok || payload?.status !== 'success' || !data) {
      return {
        available: true,
        ok: false,
        error:
          payload?.message || `Flutterwave verify returned HTTP ${res.status}`,
      };
    }

    return {
      available: true,
      ok: true,
      status: data.status ? String(data.status).trim().toLowerCase() : undefined,
      txRef: data.tx_ref ? String(data.tx_ref) : undefined,
      flwId: data.id != null ? String(data.id) : undefined,
      amount: typeof data.amount === 'number' ? data.amount : Number(data.amount),
      currency: data.currency
        ? String(data.currency).trim().toUpperCase()
        : undefined,
      rawData: data,
    };
  } catch (err) {
    return {
      available: true,
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Flutterwave verify request failed',
    };
  }
}

/**
 * Authoritatively queries Flutterwave's transaction verification endpoint by numeric transaction ID.
 */
export async function verifyFlutterwaveTransactionById(
  transactionId: string | number
): Promise<FlutterwaveRemoteVerifyResult> {
  const cleanId = String(transactionId ?? '').trim();
  if (!cleanId) {
    return {
      available: true,
      ok: false,
      error: 'Missing Flutterwave transaction ID.',
    };
  }
  return queryFlutterwaveVerifyEndpoint(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
      cleanId
    )}/verify`
  );
}

/**
 * Authoritatively queries Flutterwave's transaction verification endpoint by tx_ref.
 */
export async function verifyFlutterwaveTransactionByRef(
  txRef: string
): Promise<FlutterwaveRemoteVerifyResult> {
  const cleanRef = txRef.trim();
  if (!cleanRef) {
    return {
      available: true,
      ok: false,
      error: 'Missing transaction reference.',
    };
  }
  return queryFlutterwaveVerifyEndpoint(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
      cleanRef
    )}`
  );
}

/**
 * Handles payment verification status checks using PaymentLog as the authoritative source of truth.
 * Never transitions a gateway payment to SUCCESS from browser return params or client flags —
 * only the server webhook path moves a gateway payment to SUCCESS (payments.md line 19).
 */
export async function verifyAndAdvancePaymentLog(params: {
  reference: string;
  gatewayStatus?: string;
  transactionId?: string | number;
  poll?: boolean;
}) {
  const { reference, gatewayStatus, transactionId, poll } = params;

  const verification = await verifyPaymentFromLog(reference);
  if (!verification.found || !verification.paymentLog) {
    return { kind: 'NOT_FOUND' as const };
  }

  const paymentLog = verification.paymentLog;

  // 1. Source-of-truth SUCCESS in PaymentLog (settled via webhook or desk)
  if (verification.isVerified) {
    const receipt = generateReceipt(paymentLog);
    return {
      kind: 'SUCCESS' as const,
      status: 'SUCCESS' as const,
      verified: true,
      message: 'Payment confirmed. Your subscription has been renewed.',
      receipt,
      tier: paymentLog.member.tier,
      newExpiry: formatDateSpelledOut(paymentLog.member.expiryDate),
      paymentLog,
    };
  }

  // 2. Already terminal FAILED or ABANDONED in PaymentLog
  if (paymentLog.status === 'FAILED' || paymentLog.status === 'ABANDONED') {
    return {
      kind: 'TERMINAL_NON_SUCCESS' as const,
      status: paymentLog.status as 'FAILED' | 'ABANDONED',
      verified: false,
      message:
        paymentLog.failureReason ||
        'The payment did not go through. You have not been charged.',
      paymentLog,
    };
  }

  // 3. Cancellation check: in live mode, confirm via Flutterwave verify_by_reference
  // before trusting return query params to mark ABANDONED (payments.md line 19)
  const hasLiveKey = hasConfiguredLiveFlutterwaveKey();
  const cleanGwStatus = gatewayStatus?.trim().toLowerCase();
  if (cleanGwStatus === 'cancelled') {
    let confirmedOutcome: 'ABANDONED' | 'FAILED' | null = hasLiveKey
      ? null
      : 'ABANDONED';

    if (hasLiveKey) {
      const remoteCancelCheck = await verifyFlutterwaveTransactionByRef(reference);
      if (remoteCancelCheck.available && remoteCancelCheck.ok) {
        if (remoteCancelCheck.status === 'cancelled') {
          confirmedOutcome = 'ABANDONED';
        } else if (remoteCancelCheck.status === 'failed') {
          confirmedOutcome = 'FAILED';
        }
      }
    }

    if (confirmedOutcome) {
      const isAbandoned = confirmedOutcome === 'ABANDONED';
      const updated = await appendStageWithAttempt(prisma, paymentLog, {
        stage: isAbandoned ? 'ABANDONED_MODAL' : 'FAILED',
        status: confirmedOutcome,
        actor: hasLiveKey ? 'flutterwave_verify' : 'member_return',
        detail: isAbandoned
          ? 'Payment cancelled on gateway checkout page'
          : 'Flutterwave verification reported payment failed',
        extraData: {
          gatewayStatus: isAbandoned ? 'cancelled' : 'failed',
          failureReason: isAbandoned
            ? 'Payment was cancelled before completion. You have not been charged.'
            : 'The payment did not go through. You have not been charged.',
        },
      });
      return {
        kind: 'TERMINAL_NON_SUCCESS' as const,
        status: confirmedOutcome,
        verified: false,
        message:
          updated.failureReason ||
          'Payment was cancelled before completion. You have not been charged.',
        paymentLog: updated,
      };
    }
  }

  // 4. Transition INITIATED -> PENDING when member returns (payments.md line 27).
  // Do NOT move to SUCCESS here — await webhook confirmation.
  let currentLog: typeof paymentLog = paymentLog;
  if (paymentLog.status === 'INITIATED') {
    const updated = await appendStageWithAttempt(prisma, paymentLog, {
      stage: 'RETURNED_FROM_GATEWAY',
      status: 'PENDING',
      actor: 'member_return',
      detail: 'Member returned from gateway; awaiting webhook confirmation',
      metadata: {
        gatewayStatus: cleanGwStatus || null,
        transactionId: transactionId ? String(transactionId) : null,
      },
      extraData: {
        gatewayTxId: transactionId
          ? String(transactionId)
          : paymentLog.gatewayTxId,
        gatewayStatus: cleanGwStatus || paymentLog.gatewayStatus,
      },
    });
    currentLog = { ...paymentLog, ...updated };
  } else if (!poll) {
    const checked = await appendStageWithAttempt(prisma, currentLog, {
      stage: 'VERIFY_CHECKED',
      status: 'PENDING',
      actor: 'member_return',
      detail: 'Awaiting Flutterwave webhook confirmation in PaymentLog',
    });
    currentLog = { ...currentLog, ...checked };
  }

  return {
    kind: 'PENDING' as const,
    status: 'PENDING' as const,
    verified: false,
    message: 'Checking your payment. Waiting for webhook confirmation...',
    paymentLog: currentLog,
  };
}

/**
 * Records webhook receipt, failure, or amount/currency mismatch onto PaymentLog (single source of truth).
 */
export async function recordWebhookInspection(params: {
  txRef: string;
  event: string;
  gatewayStatus: string;
  flwId?: string | number;
  chargedAmount?: number;
  currency?: string;
}) {
  const { txRef, event, gatewayStatus, flwId, chargedAmount, currency } = params;
  const paymentLog = await prisma.paymentLog.findUnique({
    where: { gatewayRef: txRef },
  });

  if (!paymentLog) {
    return { found: false as const };
  }

  const normalizedStatus = gatewayStatus.trim().toLowerCase();
  const normalizedCurrency =
    typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  const expectedKobo = paymentLog.amountKobo;
  const incomingKobo = Math.round(Number(chargedAmount || 0) * 100);

  // Enforce currency (NGN) and exact amount before mutating PaymentLog state
  const currencyMismatch =
    normalizedStatus === 'successful' && normalizedCurrency !== 'NGN';
  const amountMismatch =
    normalizedStatus === 'successful' && incomingKobo !== expectedKobo;

  if (currencyMismatch || amountMismatch) {
    const mismatchReasons: string[] = [];
    if (currencyMismatch) {
      mismatchReasons.push(
        `Expected currency NGN, got ${normalizedCurrency || 'missing'}`
      );
    }
    if (amountMismatch) {
      mismatchReasons.push(
        `Expected ${expectedKobo} kobo, got ${incomingKobo} kobo`
      );
    }
    const mismatchMsg = mismatchReasons.join('; ');
    await prisma.paymentAttempt.create({
      data: {
        paymentLogId: paymentLog.id,
        stage: 'WEBHOOK_AMOUNT_MISMATCH',
        status: paymentLog.status,
        detail: `Rejected tampered webhook: ${mismatchMsg}`,
      },
    });
    return {
      found: true as const,
      outcome: 'AMOUNT_MISMATCH' as const,
      reason: currencyMismatch
        ? ('CURRENCY_MISMATCH' as const)
        : ('AMOUNT_MISMATCH' as const),
      expectedKobo,
      incomingKobo,
      expectedCurrency: 'NGN' as const,
      incomingCurrency: normalizedCurrency || null,
      paymentLog,
    };
  }

  // Record incoming valid webhook inspection on journey log
  const inspected = await appendStageWithAttempt(prisma, paymentLog, {
    stage: 'WEBHOOK_RECEIVED',
    status: paymentLog.status as PaymentLogStatus,
    actor: 'flutterwave_webhook',
    detail: `Webhook received: event=${event}, status=${normalizedStatus}, flwId=${flwId ?? 'none'}`,
    metadata: {
      event,
      gatewayStatus: normalizedStatus,
      flwId: flwId ?? null,
      chargedAmount: chargedAmount ?? null,
      currency: normalizedCurrency || null,
    },
    extraData: {
      gatewayTxId: flwId ? String(flwId) : paymentLog.gatewayTxId,
      gatewayStatus: normalizedStatus,
    },
  });

  if (normalizedStatus !== 'successful') {
    if (inspected.status !== 'SUCCESS') {
      const nextStatus: PaymentLogStatus =
        normalizedStatus === 'cancelled' ? 'ABANDONED' : 'FAILED';
      await appendStageWithAttempt(prisma, inspected, {
        stage: nextStatus === 'ABANDONED' ? 'ABANDONED_MODAL' : 'FAILED',
        status: nextStatus,
        actor: 'flutterwave_webhook',
        detail: `Webhook reported non-successful status: ${normalizedStatus}`,
        extraData: {
          failureReason: `Gateway webhook status: ${normalizedStatus}`,
        },
      });
    }
    return {
      found: true as const,
      outcome: 'IGNORED_NON_SUCCESS' as const,
      paymentLog: inspected,
    };
  }

  if (inspected.status === 'SUCCESS') {
    return {
      found: true as const,
      outcome: 'ALREADY_SUCCESS' as const,
      paymentLog: inspected,
    };
  }

  return {
    found: true as const,
    outcome: 'READY_TO_FULFILL' as const,
    paymentLog: inspected,
  };
}

export interface FlutterwaveWebhookPayloadData {
  id?: string | number;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
}

/**
 * Unified server-side webhook processor for Flutterwave `charge.completed` events
 * (and local dev simulated webhooks when live key is absent).
 */
export async function processFlutterwaveWebhook(params: {
  event?: string;
  data?: FlutterwaveWebhookPayloadData | null;
  skipRemoteVerify?: boolean;
}) {
  const { event, data, skipRemoteVerify } = params;

  if (!event || typeof event !== 'string' || !event.trim()) {
    return {
      httpStatus: 400 as const,
      body: { error: 'Missing webhook event' },
    };
  }

  const txRef = data?.tx_ref ? String(data.tx_ref).trim() : '';

  // Ignore non-charge events cleanly while logging if a matching PaymentLog exists
  if (event !== 'charge.completed') {
    if (txRef) {
      const existing = await prisma.paymentLog.findUnique({
        where: { gatewayRef: txRef },
      });
      if (existing) {
        await prisma.paymentAttempt.create({
          data: {
            paymentLogId: existing.id,
            stage: 'WEBHOOK_IGNORED_EVENT',
            status: existing.status,
            detail: `Ignored non-charge webhook event: ${event || 'unknown'}`,
          },
        });
      }
    }
    return {
      httpStatus: 200 as const,
      body: { received: true, ignored: true, event: event || null },
    };
  }

  const gatewayStatus = data?.status ? String(data.status).trim().toLowerCase() : '';
  const flwId = data?.id != null && String(data.id).trim() !== ''
    ? String(data.id).trim()
    : undefined;
  const rawAmount = data?.amount;
  const hasValidAmount =
    typeof rawAmount === 'number'
      ? Number.isFinite(rawAmount)
      : typeof rawAmount === 'string' &&
        rawAmount.trim() !== '' &&
        Number.isFinite(Number(rawAmount));
  const chargedAmount = hasValidAmount ? Number(rawAmount) : NaN;
  const currency = data?.currency ? String(data.currency).trim().toUpperCase() : undefined;

  if (!txRef || !gatewayStatus || Number.isNaN(chargedAmount)) {
    return {
      httpStatus: 400 as const,
      body: { error: 'Missing tx_ref, amount, or status in webhook data' },
    };
  }

  const existingLog = await prisma.paymentLog.findUnique({
    where: { gatewayRef: txRef },
  });

  if (!existingLog) {
    return {
      httpStatus: 200 as const,
      body: { received: true, ignored: true, reason: 'PaymentLog not found' },
    };
  }

  // Enforce amount + currency BEFORE making any remote Flutterwave verify call
  const expectedKobo = existingLog.amountKobo;
  const incomingKobo = Math.round(chargedAmount * 100);
  const currencyMismatch =
    gatewayStatus === 'successful' && currency !== 'NGN';
  const amountMismatch =
    gatewayStatus === 'successful' && incomingKobo !== expectedKobo;

  if (currencyMismatch || amountMismatch) {
    const mismatchInspection = await recordWebhookInspection({
      txRef,
      event: event || 'charge.completed',
      gatewayStatus,
      flwId,
      chargedAmount,
      currency,
    });
    return {
      httpStatus: 400 as const,
      body: {
        error:
          mismatchInspection.found &&
          mismatchInspection.outcome === 'AMOUNT_MISMATCH' &&
          mismatchInspection.reason === 'CURRENCY_MISMATCH'
            ? 'Currency mismatch detected: expected NGN'
            : 'Amount mismatch detected',
      },
    };
  }

  // In live mode (and outside test mocks unless skipRemoteVerify=false), cross-verify numeric
  // transaction IDs with Flutterwave GET /v3/transactions/{id}/verify before mutating state
  const hasLiveKey = hasConfiguredLiveFlutterwaveKey();
  const shouldRemoteVerify =
    skipRemoteVerify === undefined
      ? hasLiveKey && process.env.NODE_ENV !== 'test'
      : !skipRemoteVerify && hasLiveKey;

  if (
    shouldRemoteVerify &&
    gatewayStatus === 'successful' &&
    existingLog.status !== 'SUCCESS'
  ) {
    if (!flwId || !/^\d+$/.test(flwId)) {
      await prisma.paymentAttempt.create({
        data: {
          paymentLogId: existingLog.id,
          stage: 'WEBHOOK_REMOTE_MISMATCH',
          status: existingLog.status,
          detail: `Rejected live webhook without numeric Flutterwave transaction ID (got ${flwId ?? 'missing'})`,
        },
      });
      return {
        httpStatus: 400 as const,
        body: { error: 'Missing numeric Flutterwave transaction ID for verification' },
      };
    }

    const remoteVerify = await verifyFlutterwaveTransactionById(flwId);
    if (remoteVerify.available && !remoteVerify.ok) {
      return {
        httpStatus: 502 as const,
        body: {
          error:
            remoteVerify.error ||
            'Failed to verify transaction with Flutterwave gateway',
        },
      };
    }

    if (remoteVerify.available && remoteVerify.ok) {
      const remoteKobo = Math.round(Number(remoteVerify.amount || 0) * 100);
      const remoteMatches =
        remoteVerify.status === 'successful' &&
        remoteVerify.txRef === txRef &&
        remoteKobo === expectedKobo &&
        (!remoteVerify.currency || remoteVerify.currency === 'NGN');

      if (!remoteMatches) {
        await prisma.paymentAttempt.create({
          data: {
            paymentLogId: existingLog.id,
            stage: 'WEBHOOK_REMOTE_MISMATCH',
            status: existingLog.status,
            detail: `Rejected webhook after Flutterwave verify mismatch (status=${remoteVerify.status ?? 'unknown'}, txRef=${remoteVerify.txRef ?? 'unknown'}, amountKobo=${remoteKobo}, currency=${remoteVerify.currency ?? 'unknown'})`,
          },
        });
        return {
          httpStatus: 400 as const,
          body: { error: 'Flutterwave transaction verification mismatch' },
        };
      }
    }
  }

  const inspection = await recordWebhookInspection({
    txRef,
    event: event || 'charge.completed',
    gatewayStatus,
    flwId,
    chargedAmount,
    currency,
  });

  if (!inspection.found) {
    return {
      httpStatus: 200 as const,
      body: { received: true, ignored: true, reason: 'PaymentLog not found' },
    };
  }

  if (inspection.outcome === 'AMOUNT_MISMATCH') {
    return {
      httpStatus: 400 as const,
      body: { error: 'Webhook amount mismatch' },
    };
  }

  if (inspection.outcome === 'IGNORED_NON_SUCCESS') {
    return {
      httpStatus: 200 as const,
      body: { received: true, status: gatewayStatus, txRef },
    };
  }

  if (inspection.outcome === 'ALREADY_SUCCESS') {
    return {
      httpStatus: 200 as const,
      body: { received: true, alreadyProcessed: true, txRef },
    };
  }

  const result = await fulfillSuccessfulPayment(
    txRef,
    flwId || 'FLW_WEBHOOK',
    'WEBHOOK'
  );

  return {
    httpStatus: 200 as const,
    body: {
      received: true,
      verified: true,
      verifiedSource: 'WEBHOOK' as const,
      status: 'SUCCESS' as const,
      alreadyProcessed: result.alreadyProcessed,
      txRef,
      memberId: result.member.id,
      newExpiry: formatDateSpelledOut(result.newExpiry),
    },
  };
}
