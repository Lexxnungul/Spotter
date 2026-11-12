import { NextRequest, NextResponse } from 'next/server';
import { initializePaymentSchema } from '../../../../lib/validations/payment';
import { initializeFlutterwavePayment } from '../../../../lib/payment';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting: 10 payment init attempts per 60s per IP
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'payment_init', {
      limit: 10,
      windowSeconds: 60,
      actionName: 'payment initialization',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many payment attempts. Please wait ${rateLimit.retryAfterSeconds} seconds.`
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

    const parsed = initializePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Invalid payment request parameters.',
        },
        { status: 400 }
      );
    }

    const { memberId, purpose, tier, redirectUrl, paymentLogId } = parsed.data;

    const result = await initializeFlutterwavePayment({
      memberId,
      purpose,
      tier,
      redirectUrl,
      paymentLogId,
    });

    if (result.isWaiting) {
      return NextResponse.json(
        {
          success: false,
          isWaiting: true,
          message: result.message,
          reference: result.reference,
          paymentLogId: result.paymentLogId,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentLink: result.paymentLink,
      reference: result.reference,
      paymentLogId: result.paymentLogId,
      amountNaira: result.amountNaira,
      amountKobo: result.amountKobo,
      isDevSandbox: Boolean(result.isDevSandbox),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Member record not found.') {
      return NextResponse.json(
        { success: false, error: 'Member record not found.' },
        { status: 404 }
      );
    }
    console.error('[API Payment Initialize Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          message ||
          'We could not start the payment. You have not been charged. Try again or pay at the desk.',
      },
      { status: 500 }
    );
  }
}

