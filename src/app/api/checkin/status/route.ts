import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { authenticateMemberRequest } from '../../../../lib/member-auth';
import { getLagosDayStart } from '../../../../lib/lagos-date';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=0' };

export async function GET(req: NextRequest) {
  try {
    const session = authenticateMemberRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Please sign in to your member account.' },
        { status: 401, headers: CACHE_HEADERS }
      );
    }

    const lagosToday = getLagosDayStart();
    const [checkIn, daysTrained] = await Promise.all([
      prisma.attendance.findFirst({
        where: { memberId: session.id, date: lagosToday },
        select: { createdAt: true },
      }),
      prisma.attendance.count({ where: { memberId: session.id } }),
    ]);

    return NextResponse.json(
      {
        success: true,
        checkedInToday: !!checkIn,
        checkedInAt: checkIn?.createdAt.toISOString() || null,
        daysTrained,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load check-in status.' },
      { status: 400, headers: CACHE_HEADERS }
    );
  }
}
