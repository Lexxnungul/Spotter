import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { authenticateStaffRequest } from '../../../../lib/staff-auth';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'receptionist-recent', {
      limit: 30,
      windowSeconds: 60,
      actionName: 'receptionist-recent',
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
        {
          status: authResult.status || 401,
          headers: {
            'Cache-Control': 'private, no-store, max-age=0',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      );
    }

    // 3. Fetch Recent Members (most recent 25 members)
    const members = await prisma.member.findMany({
      take: 25,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        memberNumber: true,
        tier: true,
        status: true,
        expiryDate: true,
        openingBalanceKobo: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    const formatted = members.map((m: any) => ({
      id: m.id,
      fullName: m.fullName,
      phone: m.phone || 'N/A',
      email: m.email || undefined,
      memberNumber: m.memberNumber || 'Pending',
      tier: m.tier,
      status: m.status,
      openingBalanceKobo: m.openingBalanceKobo,
      expiryDate: new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(m.expiryDate)),
      createdAt: m.createdAt.toISOString(),
      isClaimed: Boolean(m.passwordHash),
    }));

    return NextResponse.json(
      {
        success: true,
        issuances: formatted,
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (err: any) {
    console.error('[API Recent Issuances Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve recent issuances.' },
      { status: 500 }
    );
  }
}
