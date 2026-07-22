import { BadRequestException, ConflictException } from '@nestjs/common';
import { ExpertService } from './expert.service';

describe('ExpertService reopenForRevision', () => {
  const expert = {
    id: 'exp-1',
    email: 'expert@lumira.test',
    name: 'Expert',
    role: 'EXPERT',
    isActive: true,
  } as const;

  function buildService(orderOverrides: Record<string, unknown> = {}) {
    const order = {
      id: 'ord-1',
      orderNumber: 'LUM-001',
      status: 'COMPLETED',
      expertReview: null,
      expertValidation: null,
      ...orderOverrides,
    };

    const tx = {
      readingVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'rv-1' }),
        update: jest.fn().mockResolvedValue({ id: 'rv-1' }),
      },
      order: {
        update: jest.fn().mockResolvedValue({ ...order, status: 'AWAITING_VALIDATION' }),
      },
    };

    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const service = new ExpertService(
      prisma as never,
      {} as never,
      { get: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { deleteObject: jest.fn() } as never,
    );

    return { service, prisma, tx, order };
  }

  it('reopens COMPLETED to AWAITING_VALIDATION and stamps reopenedAt', async () => {
    const { service, tx } = buildService();
    const result = await service.reopenForRevision('ord-1', expert as never, 'typo fix');

    expect(result).toMatchObject({
      success: true,
      orderId: 'ord-1',
      status: 'AWAITING_VALIDATION',
    });
    expect(tx.readingVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rv-1' },
        data: expect.objectContaining({ reopenedAt: expect.any(Date) }),
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AWAITING_VALIDATION' }),
      }),
    );
  });

  it('rejects reopen when status is not COMPLETED', async () => {
    const { service } = buildService({ status: 'AWAITING_VALIDATION' });
    await expect(service.reopenForRevision('ord-1', expert as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects reopen when a production job is active', async () => {
    const { service } = buildService({
      expertReview: {
        production: {
          id: 'job-1',
          status: 'RUNNING',
          stage: 'GENERATING',
        },
      },
    });
    await expect(service.reopenForRevision('ord-1', expert as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
