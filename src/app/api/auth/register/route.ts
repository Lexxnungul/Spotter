import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth-security';
import { sendWelcomeEmail, sendVerificationEmail } from '../../../../lib/email';
import { registerSchema, getZodErrorMessage } from '../../../../lib/validations/auth';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../lib/rate-limit';
import { checkPwnedPassword } from '../../../../lib/pwned-passwords';
import { createVerificationCode } from '../../../../lib/email-verification';

export async function POST(req: NextRequest) {
  try {
    // 1. IP-Based Rate Limiting (5 registration attempts per 60 seconds per IP)
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'register', {
      limit: 5,
      windowSeconds: 60,
      actionName: 'register',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many account creation attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const body = await req.json();

    // 2. Zod Server-Side Schema Validation
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: getZodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }

    const {
      fullName: cleanFullName,
      email: cleanEmail,
      memberNumber: cleanMemberNumber,
      password: cleanPassword,
    } = parsed.data;

    // 3. Breached Password Lookup via Have I Been Pwned (HIBP) k-Anonymity API
    const pwnedResult = await checkPwnedPassword(cleanPassword);
    if (pwnedResult.isBreached) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This password has appeared in a known data breach and cannot be used. Please choose a different, secure password.',
          isBreached: true,
        },
        { status: 400 }
      );
    }

    // Attempt database transaction
    try {
      // Check if existing member with memberNumber or email exists
      const existingMember = await prisma.member.findFirst({
        where: {
          OR: [
            { memberNumber: cleanMemberNumber },
            { email: cleanEmail },
          ],
        },
        include: {
          consent: true,
        },
      });

      const hashed = hashPassword(cleanPassword);
      let memberRecord;

      if (existingMember) {
        if (existingMember.passwordHash) {
          return NextResponse.json(
            {
              success: false,
              error: 'An account with this member number or email already exists. Please log in.',
            },
            { status: 409 }
          );
        }

        // Link pre-existing roster member to portal credentials
        memberRecord = await prisma.member.update({
          where: { id: existingMember.id },
          data: {
            fullName: cleanFullName,
            email: cleanEmail,
            memberNumber: cleanMemberNumber,
            passwordHash: hashed,
            consent: {
              upsert: {
                create: { consentedAt: new Date() },
                update: { consentedAt: new Date() },
              },
            },
          },
        });
      } else {
        // Create new member record
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 30);

        memberRecord = await prisma.member.create({
          data: {
            fullName: cleanFullName,
            email: cleanEmail,
            memberNumber: cleanMemberNumber,
            passwordHash: hashed,
            tier: 'PREMIUM',
            status: 'ACTIVE',
            expiryDate: defaultExpiry,
            openingBalanceKobo: 0,
            consent: {
              create: {
                consentedAt: new Date(),
              },
            },
          },
        });
      }

      const expiryFormatted = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(memberRecord.expiryDate));

      const memberEmail = memberRecord.email || cleanEmail;

      // Generate 6-digit verification code using randomBytes and dispatch verification email
      const codeResult = createVerificationCode(memberEmail, memberRecord.id);
      if (codeResult.success && codeResult.code) {
        sendVerificationEmail({
          to: memberEmail,
          fullName: memberRecord.fullName,
          code: codeResult.code,
        }).catch((err) => {
          console.warn('[Verification Email Warning]:', err);
        });
      }

      // Send welcome email asynchronously without blocking registration response
      sendWelcomeEmail({
        to: memberEmail,
        fullName: memberRecord.fullName,
        memberNumber: memberRecord.memberNumber || cleanMemberNumber,
        tier: memberRecord.tier,
      }).catch((emailErr) => {
        console.warn('[Welcome Email Warning]:', emailErr);
      });

      return NextResponse.json(
        {
          success: true,
          member: {
            id: memberRecord.id,
            fullName: memberRecord.fullName,
            email: memberEmail,
            memberNumber: memberRecord.memberNumber || cleanMemberNumber,
            phone: memberRecord.phone || '+234 800 000 0000',
            tier: memberRecord.tier,
            status: memberRecord.status,
            expiryDate: expiryFormatted,
            daysTrained: 0,
            balanceKobo: memberRecord.openingBalanceKobo,
            deviceToken: `dev_tok_${Math.random().toString(36).slice(2, 10)}`,
            linkedAt: new Date().toISOString(),
            consentedAt: new Date().toISOString(),
            isEmailVerified: false,
          },
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      console.error('[API Register Database Error]:', dbError);

      // Handle duplicate unique constraint violations (memberNumber or email)
      if (dbError?.code === 'P2002') {
        const target = Array.isArray(dbError?.meta?.target)
          ? dbError.meta.target.join(' ')
          : String(dbError?.meta?.target || '');
        const isEmail = target.toLowerCase().includes('email');
        return NextResponse.json(
          {
            success: false,
            error: isEmail
              ? 'An account with this email address already exists. Please log in.'
              : 'An account with this member number already exists. Please log in.',
          },
          { status: 409 }
        );
      }

      // Distinguish database reachability failure (e.g. Prisma code P1001)
      const isConnectionError =
        dbError?.code === 'P1001' ||
        dbError?.message?.includes("Can't reach database server") ||
        dbError?.message?.includes('connect ECONNREFUSED');

      if (isConnectionError) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Database server unreachable. Please ensure your database is running and reachable.',
            isDatabaseUnreachable: true,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: dbError?.message || 'Failed to save member in database.',
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Invalid registration request.' },
      { status: 400 }
    );
  }
}
