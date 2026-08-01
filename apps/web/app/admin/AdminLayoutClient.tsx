'use client';

import { usePathname } from 'next/navigation';
import { ExpertAuthProvider } from '../../context/ExpertAuthContext';

/**
 * Client-side Desk wrapper. Metadata stays in the parent server layout so the
 * complete Desk surface is explicitly marked as private before hydration.
 */
export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login page - no provider needed
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // All other routes get ExpertAuthProvider.
  // Desk v2 routes have their own DeskLayout in (desk-v2)/layout.tsx.
  return <ExpertAuthProvider>{children}</ExpertAuthProvider>;
}
