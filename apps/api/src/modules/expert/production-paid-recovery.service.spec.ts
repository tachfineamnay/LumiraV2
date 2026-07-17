import { ConfigService } from '@nestjs/config';
import { ProductionPaidRecoveryService } from './production-paid-recovery.service';

const staleJob = {
  id: 'prod-1',
  orderId: 'order-1',
  orderNumber: 'LUM-001',
  type: 'READING_GENERATION',
  status: 'RUNNING',
  stage: 'STARTING',
  attempts: 1,
  maxAttempts: 3,
  requestedByExpertId: 'expert-1',
  queuedAt: '2026-07-17T09:00:00.000Z',
  startedAt: '2026-07-17T09:01:00.000Z',
  heartbeatAt: '2026-07-17T09:01:00.000Z',
};

function config() {
  return {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'PRODUCTION_WORKER_ENABLED') return 'true';
      if (key === 'PRODUCTION_JOB_STALE_MS') return '60000';
      return fallback;
    }),
  } as unknown as ConfigService;
}

describe('ProductionPaidRecoveryService', () => {
  it('requeues a stale reading claimed while its order is still PAID', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'order-1', expertReview: { assignedBy: 'expert-1', production: staleJob } },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ProductionPaidRecoveryService(prisma as never, config());

    await expect(service.scan(Date.parse('2026-07-17T09:03:00.000Z'))).resolves.toBe(1);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'PAID',
        expertReview: expect.objectContaining({
          production: expect.objectContaining({
            id: 'prod-1',
            status: 'QUEUED',
            stage: 'RECOVERED_AFTER_RESTART',
          }),
        }),
      }),
    });
  });

  it('fails the job after its maximum number of attempts', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            expertReview: {
              production: { ...staleJob, attempts: 3, maxAttempts: 3 },
            },
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ProductionPaidRecoveryService(prisma as never, config());

    await expect(service.scan(Date.parse('2026-07-17T09:03:00.000Z'))).resolves.toBe(1);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        expertReview: expect.objectContaining({
          production: expect.objectContaining({ status: 'FAILED', stage: 'STALE_MAX_ATTEMPTS' }),
        }),
      }),
    });
  });
});
