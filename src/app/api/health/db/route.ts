import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Run a lightweight raw query or count
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'connected',
      message: 'Database connection is healthy and responsive.',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'disconnected',
        error: error?.message || 'Unable to connect to database.',
        code: error?.code,
        hint: 'Please ensure PostgreSQL server is running and DATABASE_URL in .env is configured correctly.',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
