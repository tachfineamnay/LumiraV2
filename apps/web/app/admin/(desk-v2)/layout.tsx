'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { DeskLayout } from '@/components/desk-v2/layout/DeskLayout';
import api from '@/lib/api';

export default function DeskV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('expert_token');
      
      if (!token) {
        router.push('/admin/login');
        return;
      }

      try {
        await api.get('/api/expert/verify');
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('expert_token');
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, [pathname, router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Chargement...</span>
        </div>
      </div>
    );
  }

  // Show DeskLayout when authenticated
  if (isAuthenticated) {
    return <DeskLayout>{children}</DeskLayout>;
  }

  return null;
}
