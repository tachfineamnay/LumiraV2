'use client';

import { OrderWorkflow } from '@/components/desk-v2/studio/OrderWorkflow';
import { OrderControlStrip } from '@/components/desk-v2/studio/OrderControlStrip';

interface StudioPageProps {
  params: { id: string };
}

export default function StudioPage({ params }: StudioPageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <OrderControlStrip orderId={params.id} />
      <div className="min-h-0 flex-1">
        <OrderWorkflow orderId={params.id} />
      </div>
    </div>
  );
}
