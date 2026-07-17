import { BadRequestException, CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ProductionCancelInterceptor } from './production-cancel.interceptor';

function contextFor(path: string) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', originalUrl: path }),
    }),
  } as unknown as ExecutionContext;
}

describe('ProductionCancelInterceptor', () => {
  it('allows cancellation only for the current queued job', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            expertReview: {
              production: {
                id: 'prod-current',
                orderId: 'order-1',
                orderNumber: 'LUM-001',
                type: 'READING_GENERATION',
                status: 'QUEUED',
                stage: 'QUEUED',
                attempts: 0,
                maxAttempts: 3,
                requestedByExpertId: 'expert-1',
                queuedAt: '2026-07-17T10:00:00.000Z',
              },
            },
          },
        ]),
      },
    };
    const interceptor = new ProductionCancelInterceptor(prisma as never);
    const next = { handle: jest.fn(() => of({ cancelled: true })) } as unknown as CallHandler;

    await expect(
      firstValueFrom(
        interceptor.intercept(
          contextFor('/api/expert/production/jobs/prod-current/cancel'),
          next,
        ),
      ),
    ).resolves.toEqual({ cancelled: true });
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('rejects a job found only in production history', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            expertReview: {
              production: {
                id: 'prod-current',
                orderId: 'order-1',
                orderNumber: 'LUM-001',
                type: 'READING_GENERATION',
                status: 'SUCCEEDED',
                stage: 'COMPLETED',
                attempts: 1,
                maxAttempts: 3,
                requestedByExpertId: 'expert-1',
                queuedAt: '2026-07-17T10:00:00.000Z',
              },
              productionHistory: [
                {
                  id: 'prod-old',
                  orderId: 'order-1',
                  orderNumber: 'LUM-001',
                  type: 'READING_GENERATION',
                  status: 'QUEUED',
                  stage: 'QUEUED',
                  attempts: 0,
                  maxAttempts: 3,
                  requestedByExpertId: 'expert-1',
                  queuedAt: '2026-07-16T10:00:00.000Z',
                },
              ],
            },
          },
        ]),
      },
    };
    const interceptor = new ProductionCancelInterceptor(prisma as never);
    const next = { handle: jest.fn(() => of({ cancelled: true })) } as unknown as CallHandler;

    await expect(
      firstValueFrom(
        interceptor.intercept(
          contextFor('/api/expert/production/jobs/prod-old/cancel'),
          next,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(next.handle).not.toHaveBeenCalled();
  });
});
