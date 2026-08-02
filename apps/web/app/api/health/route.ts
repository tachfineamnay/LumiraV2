import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiUrl = process.env.API_INTERNAL_URL?.trim();
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
