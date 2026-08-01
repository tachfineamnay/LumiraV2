import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INDEXABLE_PUBLIC_PATHS = new Set(['/', '/notre-approche', '/faq']);
const PRIVATE_PATH_PREFIXES = ['/admin', '/api', '/commande', '/payment-success', '/sanctuaire'];
const PRIVATE_CACHE_CONTROL = 'private, no-store, max-age=0';
const PRIVATE_ROBOTS_TAG = 'noindex, nofollow, noarchive, nosnippet, noimageindex';

function isPrivatePath(pathname: string) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
  response.headers.set('X-Robots-Tag', PRIVATE_ROBOTS_TAG);
  return response;
}

function isDeskHost(hostname: string) {
  return hostname === 'desk.oraclelumira.com' || hostname === 'desk.localhost';
}

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  const pathname = request.nextUrl.pathname;

  // ========================
  // DESK SUBDOMAIN ROUTING
  // ========================
  // If accessing desk.oraclelumira.com, rewrite to /admin routes
  if (isDeskHost(hostname)) {
    if (pathname === '/robots.txt') {
      return privateResponse(
        new NextResponse('User-agent: *\nDisallow: /\n', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      );
    }

    if (
      pathname === '/sitemap.xml' ||
      pathname === '/sanctuaire' ||
      pathname.startsWith('/sanctuaire/')
    ) {
      return privateResponse(new NextResponse('Not Found', { status: 404 }));
    }

    // BLOCK SANCTUAIRE ACCESS FROM DESK
    // Already on /admin path - let it through
    if (pathname.startsWith('/admin')) {
      return privateResponse(NextResponse.next());
    }

    // API routes and static assets - pass through
    if (
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')
    ) {
      return privateResponse(NextResponse.next());
    }

    // Rewrite root and other paths to /admin equivalent
    // e.g. desk.com/orders -> desk.com/admin/orders
    const newUrl = new URL(`/admin${pathname === '/' ? '' : pathname}`, request.url);
    return privateResponse(NextResponse.rewrite(newUrl));
  }

  // The public domain has one HTTPS, non-www representation. Desk has its
  // own subdomain and was intentionally handled above.
  if (hostname === 'www.oraclelumira.com') {
    const canonical = request.nextUrl.clone();
    canonical.protocol = 'https:';
    canonical.host = 'oraclelumira.com';
    return NextResponse.redirect(canonical, 308);
  }

  // Only known public content routes are normalised. Query parameters used by
  // Stripe and authenticated flows are deliberately never touched here.
  const lowerPathname = pathname.toLowerCase();
  if (pathname !== lowerPathname && INDEXABLE_PUBLIC_PATHS.has(lowerPathname)) {
    const canonical = request.nextUrl.clone();
    canonical.pathname = lowerPathname;
    return NextResponse.redirect(canonical, 308);
  }

  const response = NextResponse.next();
  if (isPrivatePath(pathname)) {
    return privateResponse(response);
  }
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
