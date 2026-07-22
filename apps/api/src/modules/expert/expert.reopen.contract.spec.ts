import { readFileSync } from 'fs';
import { join } from 'path';

describe('Post-delivery reopen contracts', () => {
  const expertService = readFileSync(join(__dirname, './expert.service.ts'), 'utf8');
  const expertController = readFileSync(join(__dirname, './expert.controller.ts'), 'utf8');
  const workflow = readFileSync(
    join(__dirname, '../../../../web/components/desk-v2/studio/OrderWorkflow.tsx'),
    'utf8',
  );

  it('exposes reopen and deliveries endpoints', () => {
    expect(expertController).toContain("@Post('orders/:id/reopen')");
    expect(expertController).toContain("@Get('orders/:id/deliveries')");
    expect(expertController).toContain("@Get('orders/:id/deliveries/:deliveryId/pdf')");
    expect(expertService).toContain('reopenForRevision');
    expect(expertService).toContain('replaceCurrentAudioAssets');
    expect(expertService).toContain("COMPLETED: ['AWAITING_VALIDATION']");
  });

  it('shows Desk reopen CTA and PDF history panel', () => {
    expect(workflow).toContain('Réouvrir');
    expect(workflow).toContain('/expert/orders/${orderId}/reopen');
    expect(workflow).toContain('Historique PDF');
    expect(workflow).toContain('/expert/orders/${orderId}/deliveries');
  });
});
