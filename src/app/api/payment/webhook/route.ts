import { NextRequest, NextResponse } from 'next/server';
import {
  processFlutterwaveWebhook,
  verifyFlutterwaveWebhookSignature,
} from '../../../../lib/payment';

export async function POST(req: NextRequest) {
  try {
    const signatureHeader = req.headers.get('verif-hash');
    const signatureCheck = verifyFlutterwaveWebhookSignature(signatureHeader);

    if (signatureCheck.misconfigured) {
      return NextResponse.json(
        { error: 'Webhook signature secret is not configured.' },
        { status: 503 }
      );
    }

    if (!signatureCheck.valid) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    let payload: {
      event?: string;
      data?: {
        id?: string | number;
        tx_ref?: string;
        flw_ref?: string;
        amount?: number | string;
        currency?: string;
        status?: string;
      };
    } | null = null;

    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON webhook payload' },
        { status: 400 }
      );
    }

    const result = await processFlutterwaveWebhook({
      event: payload?.event,
      data: payload?.data,
    });

    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (err) {
    console.error('[Flutterwave Webhook Error]:', err);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
