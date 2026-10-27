import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { authenticateStaffRequest } from '../../../../lib/staff-auth';
import { generateUniqueMemberNumber } from '../../../../lib/member-number';
import { generateMemberNumberSchema } from '../../../../lib/validations/receptionist';
import { getZodErrorMessage } from '../../../../lib/validations/auth';
import { getClientIp, checkRateLimit, createRateLimitResponse } from '../../../../lib/rate-limit';
import { sendMemberNumberIssuedEmail } from '../../../../lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. IP-Based Rate Limiting for Staff Endpoint (15 operations per 60 seconds per IP)
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp, 'receptionist-generate', {
      limit: 15,
      windowSeconds: 60,
      actionName: 'receptionist-generate',
    });

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        `Front-desk rate limit reached. Please wait ${rateLimit.retryAfterSeconds} seconds before generating another member number.`
      );
    }

    // 2. Strict Staff / Owner Permission Verification
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

    const { staff } = authResult;

    // 3. Request Body & Zod Schema Validation
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload.' },
        { status: 400 }
      );
    }

    const parsed = generateMemberNumberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: getZodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }

    const {
      fullName: cleanFullName,
      phone: cleanPhone,
      tier,
      email: cleanEmail,
      initialPaymentKobo,
      paymentMethod,
    } = parsed.data;

    // 4. Duplicate Check (Check if phone or email already registered)
    try {
      const existing = await prisma.member.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ],
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          memberNumber: true,
          passwordHash: true,
          tier: true,
        },
      });

      if (existing) {
        const duplicateField = existing.phone === cleanPhone ? 'phone number' : 'email address';
        return NextResponse.json(
          {
            success: false,
            error: `An existing member (${existing.fullName}) is already registered with this ${duplicateField}. Member Number: #${existing.memberNumber || 'Unassigned'}.`,
            existingMember: {
              id: existing.id,
              fullName: existing.fullName,
              memberNumber: existing.memberNumber,
              tier: existing.tier,
              isClaimed: Boolean(existing.passwordHash),
            },
          },
          { status: 409 }
        );
      }

      // 5. Cryptographically Secure Member Number Generation
      const memberNumber = await generateUniqueMemberNumber();

      // 6. Set 30-Day Expiry from generation date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      // 7. Persist Intending Member in Database
      const newMember = await prisma.member.create({
        data: {
          fullName: cleanFullName,
          phone: cleanPhone,
          email: cleanEmail || null,
          memberNumber,
          passwordHash: null, // Intending member will set password upon first portal registration
          tier,
          status: 'ACTIVE',
          expiryDate,
          openingBalanceKobo: initialPaymentKobo,
        },
      });

      // 8. If an initial payment was received at the desk, record payment traceability
      if (initialPaymentKobo > 0 && paymentMethod !== 'PENDING') {
        try {
          const idempotencyKey = `desk_init_pay_${newMember.id}_${Date.now()}`;
          const staffExists = await prisma.staffAccount.findUnique({
            where: { id: staff.id },
            select: { id: true },
          });

          await prisma.payment.create({
            data: {
              memberId: newMember.id,
              purpose: 'RENEWAL',
              method: paymentMethod,
              amountKobo: initialPaymentKobo,
              status: 'SUCCESS',
              idempotencyKey,
              typistId: staffExists ? staff.id : null,
              confirmedAt: new Date(),
            },
          });
        } catch (paymentErr) {
          console.warn('[Desk Initial Payment Log Warning]:', paymentErr);
        }
      }

      // 9. Dispatch Welcome/Issuance Email asynchronously if email provided
      if (cleanEmail) {
        sendMemberNumberIssuedEmail({
          to: cleanEmail,
          fullName: cleanFullName,
          memberNumber,
          tier,
          issuedByName: staff.fullName,
        }).catch((err) => {
          console.warn('[Member Number Issuance Email Warning]:', err);
        });
      }

      // 10. Format Expiry date for human presentation
      const expiryFormatted = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(expiryDate);

      return NextResponse.json(
        {
          success: true,
          memberNumber,
          member: {
            id: newMember.id,
            fullName: newMember.fullName,
            phone: newMember.phone,
            email: newMember.email || undefined,
            memberNumber: newMember.memberNumber,
            tier: newMember.tier,
            status: newMember.status,
            expiryDate: expiryFormatted,
            openingBalanceKobo: newMember.openingBalanceKobo,
            createdAt: newMember.createdAt.toISOString(),
            isClaimed: false,
            issuedBy: {
              id: staff.id,
              fullName: staff.fullName,
              role: staff.role,
            },
          },
        },
        {
          status: 201,
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
          },
        }
      );
    } catch (dbError: any) {
      console.error('[API Generate Member Number Database Error]:', dbError);

      if (dbError?.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: 'A member with this phone, email, or member number already exists. Please try again.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: dbError?.message || 'Database error while generating member number.',
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Unexpected server error.' },
      { status: 500 }
    );
  }
}
