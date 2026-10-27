import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { authenticateStaffRequest } from '../../../../lib/staff-auth';
import { normalizePhoneNumber } from '../../../../lib/validations/receptionist';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'receptionist-check', {
      limit: 30,
      windowSeconds: 60,
      actionName: 'receptionist-check',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, 'Rate limit exceeded. Please try again shortly.');
    }

    // 2. Staff Authentication & Permission Check
    const authResult = await authenticateStaffRequest(req);
    if (!authResult.authorized || !authResult.staff) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Unauthorized: Front-desk staff credentials required.',
        },
        { status: authResult.status || 401 }
      );
    }

    const body = await req.json();
    const query = (body.query || body.phone || body.email || '').trim();

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Phone number or email is required.' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(query);
    const normalizedEmail = query.toLowerCase();

    const existing = await prisma.member.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: query },
          { email: normalizedEmail },
          { memberNumber: query },
        ],
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        memberNumber: true,
        tier: true,
        status: true,
        passwordHash: true,
        expiryDate: true,
      },
    });

    if (!existing) {
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'No existing member record found. Ready for member number generation.',
      });
    }

    return NextResponse.json({
      success: true,
      exists: true,
      member: {
        id: existing.id,
        fullName: existing.fullName,
        phone: existing.phone,
        email: existing.email,
        memberNumber: existing.memberNumber,
        tier: existing.tier,
        status: existing.status,
        isClaimed: Boolean(existing.passwordHash),
        expiryDate: new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date(existing.expiryDate)),
      },
    });
  } catch (err: any) {
    console.error('[API Check Member Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to verify member records.' },
      { status: 500 }
    );
  }
}
