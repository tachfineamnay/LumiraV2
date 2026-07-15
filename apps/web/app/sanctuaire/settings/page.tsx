'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sanctuaire/settings/preferences');
  }, [router]);

  return null;
}
