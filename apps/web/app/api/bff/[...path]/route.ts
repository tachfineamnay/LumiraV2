import { NextRequest, NextResponse } from 'next/server';
import { SANCTUAIRE_TOKEN_COOKIE } from '@/lib/auth-cookies';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Only proxy Sanctuaire-safe API prefixes through the BFF */
const ALLOWED_PREFIXES = [
    'auth/me',
    'auth/sanctuaire-v2',
    'users/',
    'client/',
    'dreams',
    'subscriptions/',
    'payments/checkout-intent',
    'payments/orders/',
    'chat/',
    'readings/',
    'orders/recent',
    'insights',
];

function isAllowedPath(path: string): boolean {
    return ALLOWED_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix));
}

function isSameOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || !host) {
        const secFetchSite = request.headers.get('sec-fetch-site');
        return !secFetchSite || secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none';
    }
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
    const path = pathSegments.join('/');

    if (!isAllowedPath(path)) {
        return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOrigin(request)) {
        return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    const token = request.cookies.get(SANCTUAIRE_TOKEN_COOKIE)?.value;
    const search = request.nextUrl.search;
    const targetUrl = `${apiUrl}/api/${path}${search}`;

    const headers = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) {
        headers.set('content-type', contentType);
    }
    if (token) {
        headers.set('authorization', `Bearer ${token}`);
    }

    const init: RequestInit = {
        method: request.method,
        headers,
        cache: 'no-store',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = await request.arrayBuffer();
    }

    const upstream = await fetch(targetUrl, init);
    const responseBody = await upstream.arrayBuffer();

    const response = new NextResponse(responseBody, {
        status: upstream.status,
        headers: {
            'content-type': upstream.headers.get('content-type') || 'application/json',
        },
    });

    // Clear stale cookie on unauthorized
    if (upstream.status === 401 && token) {
        response.cookies.set(SANCTUAIRE_TOKEN_COOKIE, '', {
            httpOnly: true,
            path: '/',
            maxAge: 0,
        });
    }

    return response;
}

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, params.path);
}

export async function POST(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, params.path);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, params.path);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, params.path);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { path: string[] } },
) {
    return proxyRequest(request, params.path);
}
