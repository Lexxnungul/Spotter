import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailCode } from '../../../../lib/email-verification';
import { verifyEmailSchema, getZodErrorMessage } from '../../../../lib/validations/auth';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // 1. IP-Based Rate Limiting (10 verify attempts per 60 seconds per IP)
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'verify-email', {
      limit: 10,
      windowSeconds: 60,
      actionName: 'verify email',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Too many verification attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
      );
    }

    const body = await req.json();

    // 2. Server-Side Zod Schema Validation
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: getZodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { email: cleanEmail, code: cleanCode } = parsed.data;

    // 3. Verify Code
    const result = await verifyEmailCode(cleanEmail, cleanCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Email address verified successfully.',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Invalid verification request.' },
      { status: 400 }
    );
  }
}
