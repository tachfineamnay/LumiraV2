import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INDEXABLE_PUBLIC_PATHS = new Set(['/', '/notre-approche', '/faq']);
const PRIVATE_PATH_PREFIXES = ['/admin', '/api', '/commande', '/payment-success', '/sanctuaire'];
const TRACKING_PARAMETERS = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|_ga$|_gl$)/i;

function isPrivatePath(pathname: string) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').toLowerCase();
  const pathname = request.nextUrl.pathname;

  // ========================
  // DESK SUBDOMAIN ROUTING
  // ========================
  // If accessing desk.oraclelumira.com, rewrite to /admin routes
  if (hostname.includes('desk.oraclelumira.com') || hostname.includes('desk.localhost')) {
    // BLOCK SANCTUAIRE ACCESS FROM DESK
    if (pathname.startsWith('/sanctuaire')) {
      return NextResponse.rewrite(new URL('/404', request.url));
    }

    // Already on /admin path - let it through
    if (pathname.startsWith('/admin')) {
      return NextResponse.next();
    }

    // API routes and static assets - pass through
    if (
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')
    ) {
      return NextResponse.next();
    }

    // Rewrite root and other paths to /admin equivalent
    // e.g. desk.com/orders -> desk.com/admin/orders
    const newUrl = new URL(`/admin${pathname === '/' ? '' : pathname}`, request.url);
    return NextResponse.rewrite(newUrl);
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

  const searchParameterKeys = Array.from(request.nextUrl.searchParams.keys());
  if (
    INDEXABLE_PUBLIC_PATHS.has(pathname) &&
    searchParameterKeys.some((key) => TRACKING_PARAMETERS.test(key))
  ) {
    const canonical = request.nextUrl.clone();
    for (const key of Array.from(canonical.searchParams.keys())) {
      if (TRACKING_PARAMETERS.test(key)) canonical.searchParams.delete(key);
    }
    return NextResponse.redirect(canonical, 308);
  }

  const response = NextResponse.next();
  if (isPrivatePath(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
