import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { authenticateMemberRequest } from '../../../../lib/member-auth';
import { createCheckInCode } from '../../../../lib/checkin-codes';
import { sendCheckInCodeEmail } from '../../../../lib/email';
import { getLagosDayStart } from '../../../../lib/lagos-date';
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
} from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=0' };

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(getClientIp(req), 'checkin-generate', {
      limit: 5,
      windowSeconds: 60,
      actionName: 'check-in code generation',
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many check-in codes requested. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const session = authenticateMemberRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Please sign in to your member account.' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const member = await prisma.member.findUnique({
      where: { id: session.id },
      select: { id: true, fullName: true, email: true },
    });
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member account not found.' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }
    if (!member.email) {
      return NextResponse.json(
        { success: false, error: 'No email address is linked to your member account.' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const lagosToday = getLagosDayStart();
    const existingCheckIn = await prisma.attendance.findFirst({
      where: { memberId: member.id, date: lagosToday },
      select: { createdAt: true },
    });

    if (existingCheckIn) {
      const daysTrained = await prisma.attendance.count({ where: { memberId: member.id } });
      return NextResponse.json(
        {
          success: true,
          alreadyCheckedIn: true,
          checkedInAt: existingCheckIn.createdAt.toISOString(),
          daysTrained,
        },
        { headers: CACHE_HEADERS }
      );
    }

    const { code, createdAt, expiresAt } = createCheckInCode({
      memberId: member.id,
      fullName: member.fullName,
      email: member.email,
    });

    const emailResult = await sendCheckInCodeEmail({
      to: member.email,
      fullName: member.fullName,
      code,
      generatedAt: createdAt,
      expiresAt,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, error: 'We could not email your check-in code. Please try again.' },
        { status: 500, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        alreadyCheckedIn: false,
        code,
        generatedAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        emailedTo: member.email,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate check-in code.' },
      { status: 400, headers: CACHE_HEADERS }
    );
  }
}
