import { NextRequest, NextResponse } from 'next/server';
import { paymentJourneySchema } from '../../../../lib/validations/payment';
import { recordPaymentJourneyStep } from '../../../../lib/payment';
import {
  getClientIp,
  checkRateLimit,
  createRateLimitResponse,
} from '../../../../lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'payment_journey', {
      limit: 60,
      windowSeconds: 60,
      actionName: 'payment journey logging',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many payment requests. Please wait ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const parsed = paymentJourneySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            parsed.error.issues[0]?.message ||
            'Invalid payment journey payload.',
        },
        { status: 400 }
      );
    }

    const result = await recordPaymentJourneyStep(parsed.data);

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: 'Member not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentLogId: result.paymentLog?.id || null,
      status: result.paymentLog?.status || null,
      stage: result.paymentLog?.currentStage || null,
      hasWaitingPayment: result.hasWaitingPayment,
    });
  } catch (error: any) {
    console.error('[API Payment Journey Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record payment journey step.' },
      { status: 500 }
    );
  }
}

