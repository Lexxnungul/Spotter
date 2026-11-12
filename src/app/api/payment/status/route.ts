import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import {
  generateReceipt,
  getOpenPaymentWithin30Minutes,
  parseJourneyEvents,
  SUBSCRIPTION_FEES_NAIRA,
  formatDateSpelledOut,
} from '../../../../lib/payment';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: 'Member ID is required.' },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        paymentLogs: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member not found.' },
        { status: 404 }
      );
    }

    // Check for open payment (INITIATED / PENDING) in last 30 minutes
    const openPayment = await getOpenPaymentWithin30Minutes(member.id);

    // Authoritative verification truth derived strictly from PaymentLog
    const successfulPayments = member.paymentLogs.filter(
      (p) => p.status === 'SUCCESS'
    );
    const isNewMember = successfulPayments.length === 0;
    const now = new Date();
    const hasActiveSubscription =
      !isNewMember && new Date(member.expiryDate) > now;
    const isExpired = !isNewMember && new Date(member.expiryDate) <= now;

    let expiryFormatted = 'Not Subscribed';
    if (!isNewMember) {
      expiryFormatted = formatDateSpelledOut(member.expiryDate);
    }

    // Only verified SUCCESS entries in PaymentLog yield official receipts
    const receipts = successfulPayments.map((p) =>
      generateReceipt({
        ...p,
        member: {
          fullName: member.fullName,
          memberNumber: member.memberNumber,
        },
      })
    );

    const paymentLogs = member.paymentLogs.map((p) => ({
      id: p.id,
      purpose: p.purpose,
      tier: p.tier,
      method: p.method,
      amountKobo: p.amountKobo,
      status: p.status,
      currentStage: p.currentStage,
      gatewayRef: p.gatewayRef,
      verifiedSource: p.verifiedSource,
      verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
      failureReason: p.failureReason,
      journeyEvents: parseJourneyEvents(p.journeyEvents),
      createdAt: p.createdAt.toISOString(),
      confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        fullName: member.fullName,
        memberNumber: member.memberNumber,
        tier: member.tier,
        status: member.status,
        expiryDate: member.expiryDate.toISOString(),
        expiryFormatted,
        isNewMember,
        hasActiveSubscription,
        isExpired,
        verifiedPaymentsCount: successfulPayments.length,
        balanceKobo: member.openingBalanceKobo,
      },
      pricing: SUBSCRIPTION_FEES_NAIRA,
      hasWaitingPayment: Boolean(openPayment),
      waitingPayment: openPayment
        ? {
            id: openPayment.id,
            reference: openPayment.gatewayRef,
            amountKobo: openPayment.amountKobo,
            status: openPayment.status,
            currentStage: openPayment.currentStage,
            createdAt: openPayment.createdAt.toISOString(),
          }
        : null,
      receipts,
      paymentLogs,
    });
  } catch (error: any) {
    console.error('[API Payment Status Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve payment status.' },
      { status: 500 }
    );
  }
}
