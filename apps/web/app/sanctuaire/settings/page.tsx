'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRootPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to history as the first settings tab
        router.push('/sanctuaire/settings/history');
    }, [router]);

    return null;
}
