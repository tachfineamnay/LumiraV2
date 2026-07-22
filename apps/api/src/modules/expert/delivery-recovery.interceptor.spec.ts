import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, throwError } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryRecoveryInterceptor } from './delivery-recovery.interceptor';

function context(path: string, body: Record<string, unknown> = {}): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', originalUrl: `/api${path}`, body }),
    }),
  } as unknown as ExecutionContext;
}

describe('DeliveryRecoveryInterceptor', () => {
  const prisma = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    readingVersion: {
      findFirst: jest.fn(),
    },
  };
  const interceptor = new DeliveryRecoveryInterceptor(prisma as unknown as PrismaService);
  const deliveryError = new Error('Gotenberg unavailable');
  const next = {
    handle: jest.fn(() => throwError(() => deliveryError)),
  } as CallHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.order.findUnique.mockResolvedValue({ status: 'FAILED' });
    prisma.readingVersion.findFirst.mockResolvedValue({
      id: 'version-1',
      contentHash: 'hash-1',
    });
    prisma.order.update.mockResolvedValue({ id: 'order-1' });
  });

  it('restores AWAITING_VALIDATION after a retryable Studio finalization failure', async () => {
    await expect(
      firstValueFrom(
        interceptor.intercept(context('/expert/orders/order-1/finalize'), next),
      ),
    ).rejects.toThrow('Gotenberg unavailable');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'AWAITING_VALIDATION',
        errorLog: expect.stringContaining('[DELIVERY_RETRYABLE]'),
      }),
    });
  });

  it('supports the legacy validate-content route', async () => {
    await expect(
      firstValueFrom(
        interceptor.intercept(
          context('/expert/validate-content', { orderId: 'order-2' }),
          next,
        ),
      ),
    ).rejects.toThrow('Gotenberg unavailable');

    expect(prisma.readingVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: 'order-2', status: 'SEALED' } }),
    );
  });

  it('does not change an order when no sealed version exists', async () => {
    prisma.readingVersion.findFirst.mockResolvedValue(null);

    await expect(
      firstValueFrom(
        interceptor.intercept(context('/expert/orders/order-1/finalize'), next),
      ),
    ).rejects.toThrow('Gotenberg unavailable');

    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
