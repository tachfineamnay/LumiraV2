'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRootPage() {
    const router = useRouter();

    useEffect(() => {
        router.push('/sanctuaire/settings/general');
    }, [router]);

    return null;
}
