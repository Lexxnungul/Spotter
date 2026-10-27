import { NextResponse } from 'next/server';
import { STAFF_COOKIE_NAME } from '../../../../lib/staff-auth';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.delete(STAFF_COOKIE_NAME);
  return response;
}
