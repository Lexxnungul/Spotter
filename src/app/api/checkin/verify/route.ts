import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { lookupCheckInCode, markCheckInCodeUsed } from '../../../../lib/checkin-codes';
import { checkInCodeSchema } from '../../../../lib/validations/checkin';
import { getZodErrorMessage } from '../../../../lib/validations/auth';
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
} from '../../../../lib/rate-limit';
import { getLagosDayStart } from '../../../../lib/lagos-date';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=0' };

export async function POST(req: NextRequest) {
  let codeHashToConsume: string | null = null;

  try {
    const rateLimit = checkRateLimit(getClientIp(req), 'checkin-verify', {
      limit: 10,
      windowSeconds: 60,
      actionName: 'check-in verification',
    });
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many check-in attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const body = await req.json();
    const parsed = checkInCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: getZodErrorMessage(parsed.error) },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const lookup = lookupCheckInCode(parsed.data.code);
    if (lookup.status === 'not_found') {
      return NextResponse.json(
        { success: false, error: 'Check-in code not found. Generate a new code from your dashboard.' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }
    if (lookup.status === 'used') {
      return NextResponse.json(
        { success: false, error: 'This check-in code has already been used.' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }
    if (lookup.status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'This check-in code has expired. Generate a new one from your dashboard.' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const verifiedCodeHash = lookup.codeHash;
    const memberId = lookup.record.memberId;
    const memberName = lookup.record.fullName;
    codeHashToConsume = verifiedCodeHash;
    const lagosToday = getLagosDayStart();

    const existingCheckIn = await prisma.attendance.findFirst({
      where: { memberId, date: lagosToday },
      select: { createdAt: true },
    });

    if (existingCheckIn) {
      markCheckInCodeUsed(verifiedCodeHash);
      const daysTrained = await prisma.attendance.count({ where: { memberId } });
      return NextResponse.json(
        {
          success: true,
          alreadyCheckedIn: true,
          checkedInAt: existingCheckIn.createdAt.toISOString(),
          daysTrained,
          memberName,
        },
        { headers: CACHE_HEADERS }
      );
    }

    const attendance = await prisma.attendance.create({
      data: {
        memberId,
        date: lagosToday,
        source: 'APP',
      },
      select: { createdAt: true },
    });

    markCheckInCodeUsed(verifiedCodeHash);
    const daysTrained = await prisma.attendance.count({ where: { memberId } });

    return NextResponse.json(
      {
        success: true,
        alreadyCheckedIn: false,
        checkedInAt: attendance.createdAt.toISOString(),
        daysTrained,
        memberName: lookup.record.fullName,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error: any) {
    if (error?.code === 'P2002' && codeHashToConsume) {
      markCheckInCodeUsed(codeHashToConsume);
      return NextResponse.json(
        {
          success: true,
          alreadyCheckedIn: true,
          error: 'Member is already checked in today.',
        },
        { headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to verify check-in code.' },
      { status: 400, headers: CACHE_HEADERS }
    );
  }
}
