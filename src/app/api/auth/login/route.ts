import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { verifyPassword } from '../../../../lib/auth-security';
import { loginSchema, getZodErrorMessage } from '../../../../lib/validations/auth';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../lib/rate-limit';
import { isEmailVerified } from '../../../../lib/email-verification';
import { createStaffToken, STAFF_COOKIE_NAME, VerifiedStaff } from '../../../../lib/staff-auth';

async function createStaffLoginResponse(staff: VerifiedStaff) {
  const token = await createStaffToken(staff);
  const res = NextResponse.json({
    success: true,
    user: {
      type: 'staff',
      staff,
    },
    token,
  });

  res.cookies.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return res;
}

export async function POST(req: NextRequest) {
  try {
    // 1. IP-Based Rate Limiting (5 login attempts per 60 seconds per IP)
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'login', {
      limit: 5,
      windowSeconds: 60,
      actionName: 'login',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const body = await req.json();

    // 2. Zod Server-Side Schema Validation
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: getZodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { identifier: cleanId, password: cleanPassword } = parsed.data;

    // 1. Staff / Owner Database & Demo Check
    try {
      const staffRecord = await prisma.staffAccount.findFirst({
        where: {
          OR: [
            { email: cleanId },
            { id: cleanId },
          ],
        },
      });

      if (staffRecord && staffRecord.passwordHash) {
        const isStaffValid = verifyPassword(cleanPassword, staffRecord.passwordHash);
        if (isStaffValid) {
          return await createStaffLoginResponse({
            id: staffRecord.id,
            fullName: staffRecord.fullName,
            email: staffRecord.email,
            role: staffRecord.role as 'STAFF' | 'OWNER',
            whatsapp: staffRecord.whatsapp,
          });
        }
      }
    } catch {
      // Continue to static check fallback
    }

    if (cleanId === 'owner@spottergym.com' && cleanPassword === 'ownerpassword') {
      return await createStaffLoginResponse({
        id: 'staff_owner_01',
        fullName: 'Emeka Eze (Owner)',
        email: 'owner@spottergym.com',
        role: 'OWNER',
        whatsapp: '+234 803 111 2222',
      });
    }

    if (
      cleanId === 'desk@spottergym.com' &&
      (cleanPassword === 'deskpassword' || cleanPassword === 'SpotterDesk#2026!')
    ) {
      return await createStaffLoginResponse({
        id: 'staff_desk_01',
        fullName: 'Chioma Okeke (Desk Staff)',
        email: 'desk@spottergym.com',
        role: 'STAFF',
        whatsapp: '+234 803 333 4444',
      });
    }

    // 2. Member Database check
    try {
      const member = await prisma.member.findFirst({
        where: {
          OR: [
            { email: cleanId },
            { memberNumber: cleanId },
          ],
        },
        include: {
          attendance: true,
        },
      });

      if (member && member.passwordHash) {
        const isValid = verifyPassword(cleanPassword, member.passwordHash);
        if (isValid) {
          const expiryFormatted = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(member.expiryDate));

          const verified = member.email ? await isEmailVerified(member.email) : false;

          return NextResponse.json({
            success: true,
            user: {
              type: 'member',
              member: {
                id: member.id,
                fullName: member.fullName,
                email: member.email || undefined,
                memberNumber: member.memberNumber || undefined,
                phone: member.phone || '+234 800 000 0000',
                tier: member.tier,
                status: member.status,
                expiryDate: expiryFormatted,
                daysTrained: member.attendance?.length || 0,
                balanceKobo: member.openingBalanceKobo,
                deviceToken: `dev_tok_${Math.random().toString(36).slice(2, 10)}`,
                linkedAt: new Date().toISOString(),
                consentedAt: new Date().toISOString(),
                isEmailVerified: verified,
              },
            },
          });
        }
      }

      // Demo fallback check (e.g. Chioma Adeyemi seed data)
      if (
        (cleanId === 'chioma@example.com' || cleanId === '1042') &&
        cleanPassword === 'password123'
      ) {
        return NextResponse.json({
          success: true,
          user: {
            type: 'member',
            member: {
              id: 'mem_1042',
              fullName: 'Chioma Adeyemi',
              email: 'chioma@example.com',
              memberNumber: '1042',
              phone: '+234 802 345 6789',
              tier: 'PREMIUM',
              status: 'ACTIVE',
              expiryDate: '28 October 2026',
              daysTrained: 12,
              balanceKobo: 0,
              deviceToken: 'dev_tok_chioma_1042',
              linkedAt: new Date().toISOString(),
              consentedAt: new Date().toISOString(),
              isEmailVerified: true,
            },
          },
        });
      }

      return NextResponse.json(
        { success: false, error: 'Invalid email, member number, or password.' },
        { status: 401 }
      );
    } catch (dbError: any) {
      console.error('[API Login Database Error]:', dbError);

      // Check fallback demo member even if DB is temporarily unreachable
      if (
        (cleanId === 'chioma@example.com' || cleanId === '1042') &&
        cleanPassword === 'password123'
      ) {
        return NextResponse.json({
          success: true,
          user: {
            type: 'member',
            member: {
              id: 'mem_1042',
              fullName: 'Chioma Adeyemi',
              email: 'chioma@example.com',
              memberNumber: '1042',
              phone: '+234 802 345 6789',
              tier: 'PREMIUM',
              status: 'ACTIVE',
              expiryDate: '28 October 2026',
              daysTrained: 12,
              balanceKobo: 0,
              deviceToken: 'dev_tok_chioma_1042',
              linkedAt: new Date().toISOString(),
              consentedAt: new Date().toISOString(),
            },
          },
        });
      }

      const isConnectionError =
        dbError?.code === 'P1001' ||
        dbError?.message?.includes("Can't reach database server") ||
        dbError?.message?.includes('connect ECONNREFUSED');

      if (isConnectionError) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Database server unreachable. Please check your PostgreSQL connection at localhost:5432 or in .env.',
            isDatabaseUnreachable: true,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Authentication service error.' },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Invalid login request.' },
      { status: 400 }
    );
  }
}
