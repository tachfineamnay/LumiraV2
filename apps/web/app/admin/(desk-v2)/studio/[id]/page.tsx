'use client';

import { StudioEditor } from '@/components/desk-v2/studio/StudioEditor';

interface StudioPageProps {
  params: { id: string };
}

export default function StudioPage({ params }: StudioPageProps) {
  return <StudioEditor orderId={params.id} />;
}
