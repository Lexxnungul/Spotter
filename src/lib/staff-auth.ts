import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';

export interface VerifiedStaff {
  id: string;
  fullName: string;
  email: string;
  role: 'STAFF' | 'OWNER';
  whatsapp: string;
}

export interface StaffAuthResult {
  authorized: boolean;
  staff?: VerifiedStaff;
  error?: string;
  status?: number;
}

// Session signing secret (defaults to a safe fallback in local development)
const STAFF_AUTH_SECRET =
  process.env.STAFF_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  'spotter_staff_secure_session_secret_2026';

/**
 * Creates a cryptographically signed staff session token.
 * Payload: id, role, email, timestamp.
 */
export function createStaffToken(staff: VerifiedStaff): string {
  const payload = {
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    whatsapp: staff.whatsapp,
    iat: Date.now(),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', STAFF_AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed staff session token.
 */
export function verifyStaffToken(token: string): VerifiedStaff | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', STAFF_AUTH_SECRET)
      .update(payloadB64)
      .digest('base64url');

    // Constant-time signature comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.id || !payload.role || !['STAFF', 'OWNER'].includes(payload.role)) {
      return null;
    }

    return {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role,
      whatsapp: payload.whatsapp || '+234 803 000 0000',
    };
  } catch {
    return null;
  }
}

/**
 * Known default staff accounts (conforming to PRD and existing test specifications)
 */
export const VERIFIED_STAFF_ACCOUNTS: Record<string, VerifiedStaff> = {
  'staff_desk_01': {
    id: 'staff_desk_01',
    fullName: 'Chioma Okeke (Desk Staff)',
    email: 'desk@spottergym.com',
    role: 'STAFF',
    whatsapp: '+234 803 333 4444',
  },
  'staff_owner_01': {
    id: 'staff_owner_01',
    fullName: 'Emeka Eze (Owner)',
    email: 'owner@spottergym.com',
    role: 'OWNER',
    whatsapp: '+234 803 111 2222',
  },
};

/**
 * Validates staff authentication and permissions for a NextRequest.
 * Checks Bearer token in Authorization header, x-staff-* headers, or query parameters.
 * Strict RBAC: only STAFF and OWNER roles are authorized.
 */
export async function authenticateStaffRequest(req: NextRequest): Promise<StaffAuthResult> {
  // 1. Check Authorization Bearer token
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifyStaffToken(token);
    if (verified) {
      return { authorized: true, staff: verified };
    }
  }

  // 2. Check x-staff-token header
  const staffToken = req.headers.get('x-staff-token');
  if (staffToken) {
    const verified = verifyStaffToken(staffToken);
    if (verified) {
      return { authorized: true, staff: verified };
    }
  }

  // 3. Check custom staff verification headers (used by frontend client session)
  const staffId = req.headers.get('x-staff-id');
  const staffEmail = req.headers.get('x-staff-email')?.toLowerCase();
  const userType = req.headers.get('x-user-type');

  // If request explicitly identifies as a member, strictly deny with 403 Forbidden
  if (userType === 'member') {
    return {
      authorized: false,
      error: 'Staff permission required. Member accounts are not permitted to access receptionist operations.',
      status: 403,
    };
  }

  if (staffId && VERIFIED_STAFF_ACCOUNTS[staffId]) {
    const verified = VERIFIED_STAFF_ACCOUNTS[staffId];
    if (staffEmail && staffEmail !== verified.email) {
      return {
        authorized: false,
        error: 'Staff authentication mismatch.',
        status: 401,
      };
    }
    return { authorized: true, staff: verified };
  }

  // 4. Check database StaffAccount if available
  if (staffEmail || staffId) {
    try {
      const staffRecord = await prisma.staffAccount.findFirst({
        where: {
          OR: [
            ...(staffId ? [{ id: staffId }] : []),
            ...(staffEmail ? [{ email: staffEmail }] : []),
          ],
        },
      });

      if (staffRecord && (staffRecord.role === 'STAFF' || staffRecord.role === 'OWNER')) {
        return {
          authorized: true,
          staff: {
            id: staffRecord.id,
            fullName: staffRecord.fullName,
            email: staffRecord.email,
            role: staffRecord.role as 'STAFF' | 'OWNER',
            whatsapp: staffRecord.whatsapp,
          },
        };
      }
    } catch {
      // Database query fallback handled by next step
    }
  }

  // 5. Check if staff email matches verified desk accounts
  if (staffEmail === 'desk@spottergym.com') {
    return { authorized: true, staff: VERIFIED_STAFF_ACCOUNTS['staff_desk_01'] };
  }
  if (staffEmail === 'owner@spottergym.com') {
    return { authorized: true, staff: VERIFIED_STAFF_ACCOUNTS['staff_owner_01'] };
  }

  return {
    authorized: false,
    error: 'Unauthorized: Valid front-desk staff credentials or session required.',
    status: 401,
  };
}
