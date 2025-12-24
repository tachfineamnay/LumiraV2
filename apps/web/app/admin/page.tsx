'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to orders by default
        router.replace('/admin/orders');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-pulse text-white/40">Chargement...</div>
        </div>
    );
}
