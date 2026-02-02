'use client';

import { OrderWorkflow } from '@/components/desk-v2/studio/OrderWorkflow';

interface StudioPageProps {
  params: { id: string };
}

export default function StudioPage({ params }: StudioPageProps) {
  return <OrderWorkflow orderId={params.id} />;
}
