import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET', 'API_INTERNAL_URL'] as const;
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length > 0) {
      return NextResponse.json(
        { status: 'error', service: 'web', missing },
        { status: 503 },
      );
    }
  }

  const apiUrl = process.env.API_INTERNAL_URL;
  if (apiUrl) {
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error(`API health returned ${response.status}`);
    } catch {
      return NextResponse.json(
        { status: 'error', service: 'web', dependency: 'api' },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({ status: 'ok', service: 'web', api: apiUrl ? 'ok' : 'not-configured' });
}
