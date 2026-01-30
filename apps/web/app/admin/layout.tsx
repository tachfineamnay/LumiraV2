"use client";

import { usePathname } from "next/navigation";
import { ExpertAuthProvider } from "../../context/ExpertAuthContext";

/**
 * Admin Layout - Minimal wrapper
 * 
 * Routes:
 * - /admin/login → No layout (just auth page)
 * - /admin/board, /admin/studio/[id] → Desk v2 Layout (handled by route group)
 * - /admin/settings, /admin/clients → Simple wrapper with ExpertAuthProvider
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Login page - no provider needed
    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    // All other routes get ExpertAuthProvider
    // Desk v2 routes have their own DeskLayout in (desk-v2)/layout.tsx
    return (
        <ExpertAuthProvider>
            {children}
        </ExpertAuthProvider>
    );
}
