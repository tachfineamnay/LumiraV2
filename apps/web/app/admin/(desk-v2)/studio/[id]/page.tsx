'use client';

import { use } from 'react';
import { StudioEditor } from '@/components/desk-v2/studio/StudioEditor';

interface StudioPageProps {
  params: Promise<{ id: string }>;
}

export default function StudioPage({ params }: StudioPageProps) {
  const { id } = use(params);
  return <StudioEditor orderId={id} />;
}
