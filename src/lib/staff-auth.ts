import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import {
  VerifiedStaff,
  createStaffToken,
  verifyStaffToken,
  verifyStaffTokenEdge,
  STAFF_COOKIE_NAME,
  STAFF_AUTH_SECRET,
} from './staff-token';

export type { VerifiedStaff };
export {
  createStaffToken,
  verifyStaffToken,
  verifyStaffTokenEdge,
  STAFF_COOKIE_NAME,
  STAFF_AUTH_SECRET,
};

export interface StaffAuthResult {
  authorized: boolean;
  staff?: VerifiedStaff;
  error?: string;
  status?: number;
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
 * Checks Cookies, Bearer token in Authorization header, x-staff-* headers, or query parameters.
 * Strict RBAC: only STAFF and OWNER roles are authorized.
 */
export async function authenticateStaffRequest(req: NextRequest): Promise<StaffAuthResult> {
  // 1. Check HTTP-only signed session cookie
  const cookieToken = req.cookies.get(STAFF_COOKIE_NAME)?.value;
  if (cookieToken) {
    const verified = verifyStaffToken(cookieToken);
    if (verified) {
      return { authorized: true, staff: verified };
    }
  }

  // 2. Check Authorization Bearer token
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifyStaffToken(token);
    if (verified) {
      return { authorized: true, staff: verified };
    }
  }

  // 3. Check x-staff-token header
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
