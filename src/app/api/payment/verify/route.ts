import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentSchema } from '../../../../lib/validations/payment';
import {
  parseJourneyEvents,
  verifyAndAdvancePaymentLog,
} from '../../../../lib/payment';

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const parsed = verifyPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Valid transaction reference is required.' },
        { status: 400 }
      );
    }

    const { reference, gatewayStatus, transactionId, poll } = parsed.data;

    const result = await verifyAndAdvancePaymentLog({
      reference,
      gatewayStatus,
      transactionId,
      poll,
    });

    if (result.kind === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: 'Transaction reference not found.' },
        { status: 404 }
      );
    }

    const journey = parseJourneyEvents(result.paymentLog.journeyEvents);

    if (result.kind === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        verified: true,
        status: 'SUCCESS',
        message: result.message,
        receipt: result.receipt,
        tier: result.tier,
        newExpiry: result.newExpiry,
        paymentLogId: result.paymentLog.id,
        verifiedSource: result.paymentLog.verifiedSource,
        verifiedAt: result.paymentLog.verifiedAt?.toISOString() || null,
        currentStage: result.paymentLog.currentStage,
        journeyEvents: journey,
      });
    }

    if (result.kind === 'TERMINAL_NON_SUCCESS') {
      return NextResponse.json({
        success: false,
        verified: false,
        status: result.status,
        error: result.message,
        paymentLogId: result.paymentLog.id,
        currentStage: result.paymentLog.currentStage,
        journeyEvents: journey,
      });
    }

    return NextResponse.json({
      success: true,
      verified: false,
      status: 'PENDING',
      message: result.message,
      paymentLogId: result.paymentLog.id,
      currentStage: result.paymentLog.currentStage,
      journeyEvents: journey,
    });
  } catch (error: any) {
    console.error('[API Payment Verify Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          'The payment could not be verified at this moment. You have not been double charged.',
      },
      { status: 500 }
    );
  }
}
