import { NextRequest, NextResponse } from 'next/server';
import { SANCTUAIRE_TOKEN_COOKIE, sanctuaireCookieOptions } from '@/lib/auth-cookies';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Minimal HS256 JWT verification without external deps (jose may not be in web package).
 * Validates signature + exp before setting httpOnly cookie.
 */
function verifyJwtHs256(token: string, secret: string): { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string } {
    const parts = token.split('.');
    if (parts.length !== 3) {
        return { ok: false, reason: 'Malformed token' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    const expected = createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

    try {
        const sigBuf = Buffer.from(signatureB64);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
            return { ok: false, reason: 'Invalid signature' };
        }
    } catch {
        return { ok: false, reason: 'Invalid signature' };
    }

    try {
        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson) as Record<string, unknown>;
        if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
            return { ok: false, reason: 'Token expired' };
        }
        if (payload.role && payload.role !== 'CLIENT') {
            return { ok: false, reason: 'Invalid role' };
        }
        return { ok: true, payload };
    } catch {
        return { ok: false, reason: 'Invalid payload' };
    }
}

function isSameOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || !host) {
        // Same-origin navigations / some browsers omit Origin on same-site POSTs
        const secFetchSite = request.headers.get('sec-fetch-site');
        return !secFetchSite || secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none';
    }
    try {
        const originHost = new URL(origin).host;
        return originHost === host;
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const token = body?.token;

    if (!token || typeof token !== 'string') {
        return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const verified = verifyJwtHs256(token, secret);
    if (!verified.ok) {
        return NextResponse.json({ error: verified.reason }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SANCTUAIRE_TOKEN_COOKIE, token, sanctuaireCookieOptions);
    return response;
}

export async function GET(request: NextRequest) {
    const token = request.cookies.get(SANCTUAIRE_TOKEN_COOKIE)?.value;
    return NextResponse.json({ authenticated: Boolean(token) });
}

export async function DELETE() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SANCTUAIRE_TOKEN_COOKIE, '', { ...sanctuaireCookieOptions, maxAge: 0 });
    return response;
}
