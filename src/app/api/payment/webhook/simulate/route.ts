import { NextRequest, NextResponse } from 'next/server';
import { simulateWebhookSchema } from '../../../../../lib/validations/payment';
import {
  hasConfiguredLiveFlutterwaveKey,
  processFlutterwaveWebhook,
  verifyPaymentFromLog,
} from '../../../../../lib/payment';

/**
 * Dev-only endpoint to simulate a gateway webhook delivery when no live Flutterwave key is configured.
 * Strictly disabled in production or when a live Flutterwave key is active.
 */
export async function POST(req: NextRequest) {
  if (
    process.env.NODE_ENV === 'production' ||
    hasConfiguredLiveFlutterwaveKey()
  ) {
    return NextResponse.json(
      { error: 'Simulated webhook endpoint is disabled in live/production mode.' },
      { status: 403 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      );
    }

    const parsed = simulateWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid simulated webhook request',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { reference, memberId, gatewayStatus } = parsed.data;
    const verification = await verifyPaymentFromLog(reference);

    if (!verification.found || !verification.paymentLog) {
      return NextResponse.json(
        { error: 'Payment record not found.' },
        { status: 404 }
      );
    }

    if (verification.paymentLog.memberId !== memberId) {
      return NextResponse.json(
        { error: 'Payment record does not belong to this member.' },
        { status: 403 }
      );
    }

    const simStatus = (gatewayStatus || 'successful').trim().toLowerCase();
    const amountNaira = Number((verification.paymentLog.amountKobo / 100).toFixed(2));
    const simFlwId =
      verification.paymentLog.gatewayTxId || `DEV_WH_${Date.now()}`;

    const webhookResult = await processFlutterwaveWebhook({
      event: 'charge.completed',
      data: {
        id: simFlwId,
        tx_ref: reference,
        amount: amountNaira,
        currency: 'NGN',
        status: simStatus,
      },
      skipRemoteVerify: true,
    });

    if (webhookResult.httpStatus >= 400) {
      return NextResponse.json(
        {
          success: false,
          status: verification.paymentLog.status,
          verifiedSource: 'WEBHOOK',
          ...webhookResult.body,
        },
        { status: webhookResult.httpStatus }
      );
    }

    const updated = await verifyPaymentFromLog(reference);
    const finalStatus =
      updated.found && updated.paymentLog
        ? updated.paymentLog.status
        : 'PENDING';

    if (finalStatus === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        verifiedSource: 'WEBHOOK',
        alreadyProcessed: Boolean(webhookResult.body.alreadyProcessed),
        message: 'Sandbox payment confirmed via webhook.',
        txRef: reference,
      });
    }

    return NextResponse.json({
      success: false,
      status: finalStatus,
      verifiedSource: 'WEBHOOK',
      message:
        finalStatus === 'ABANDONED'
          ? 'Payment was cancelled via webhook simulation.'
          : 'The payment did not go through via webhook simulation.',
      txRef: reference,
    });
  } catch (err) {
    console.error('[Webhook Simulation Error]:', err);
    return NextResponse.json(
      { error: 'Simulated webhook processing failed' },
      { status: 500 }
    );
  }
}

