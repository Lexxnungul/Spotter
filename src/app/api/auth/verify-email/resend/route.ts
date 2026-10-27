import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { sendVerificationEmail } from '../../../../../lib/email';
import {
  createVerificationCode,
  isEmailVerified,
} from '../../../../../lib/email-verification';
import { resendVerificationSchema, getZodErrorMessage } from '../../../../../lib/validations/auth';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../../lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // 1. IP-Based Rate Limiting (5 resend attempts per 60 seconds per IP)
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'resend-verification', {
      limit: 5,
      windowSeconds: 60,
      actionName: 'resend verification email',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many resend attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const body = await req.json();

    // 2. Server-Side Zod Schema Validation
    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: getZodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { email: cleanEmail } = parsed.data;

    // 3. Check if already verified
    const alreadyVerified = await isEmailVerified(cleanEmail);
    if (alreadyVerified) {
      return NextResponse.json(
        {
          success: true,
          message: 'This email address is already verified.',
          alreadyVerified: true,
        },
        { status: 200 }
      );
    }

    // 4. Look up member name if available
    let memberName = 'Member';
    let memberId: string | undefined;

    try {
      const member = await prisma.member.findFirst({
        where: { email: cleanEmail },
        select: { id: true, fullName: true },
      });
      if (member) {
        memberName = member.fullName;
        memberId = member.id;
      }
    } catch {
      // Database lookup optional, proceed with fallback
    }

    // 5. Generate 6-digit code with cooldown enforcement
    const codeResult = createVerificationCode(cleanEmail, memberId);
    if (!codeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: codeResult.error,
          retryAfterSeconds: codeResult.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // 6. Send verification email
    const emailResult = await sendVerificationEmail({
      to: cleanEmail,
      fullName: memberName,
      code: codeResult.code!,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'Failed to dispatch verification email.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'A new 6-digit verification code has been sent to your email.',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Invalid resend verification request.' },
      { status: 400 }
    );
  }
}
