import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const hostname = request.headers.get('host') || ''
    const pathname = request.nextUrl.pathname

    // ========================
    // DESK SUBDOMAIN ROUTING
    // ========================
    // If accessing desk.oraclelumira.com, rewrite to /admin routes
    if (hostname.includes('desk.oraclelumira.com') || hostname.includes('desk.localhost')) {

        // Already on /admin path - let it through
        if (pathname.startsWith('/admin')) {
            return NextResponse.next()
        }

        // API routes and static assets - pass through
        if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
            return NextResponse.next()
        }

        // Rewrite root and other paths to /admin equivalent
        const newUrl = new URL(`/admin${pathname === '/' ? '' : pathname}`, request.url)
        return NextResponse.rewrite(newUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        // Match all paths except static files
        '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
    ],
}
