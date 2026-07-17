import { ConfigService } from '@nestjs/config';
import { ExpertRole } from '@prisma/client';
import { ProductionControlService } from './production-control.service';

const expert = {
  id: 'expert-1',
  email: 'expert@example.com',
  password: 'hash',
  name: 'Expert Test',
  role: ExpertRole.EXPERT,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService(order: Record<string, unknown>) {
  const tx = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue(order),
    },
    orderFile: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const config = {
    get: jest.fn((_key: string, fallback?: string) => fallback),
  } as unknown as ConfigService;
  const service = new ProductionControlService(
    prisma as never,
    config,
    { generateContentOnly: jest.fn() } as never,
    { generateAllAudio: jest.fn() } as never,
    {
      notifyOrderStatusChange: jest.fn(),
      notifyGenerationComplete: jest.fn(),
    } as never,
  );

  return { service, prisma, tx };
}

describe('ProductionControlService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('queues a reading without pretending that processing already started', async () => {
    const { service, tx } = createService({
      id: 'order-1',
      orderNumber: 'LUM-1',
      status: 'PAID',
      expertPrompt: null,
      expertInstructions: null,
      expertReview: {
        assignedBy: expert.id,
        assignedName: expert.name,
        assignedAt: '2026-07-17T10:00:00.000Z',
        legacyField: 'preserved',
      },
      errorLog: null,
    });

    const result = await service.enqueueReading('order-1', expert, {
      expertPrompt: 'Conserver un ton clair',
    });

    expect(result).toMatchObject({ accepted: true, status: 'QUEUED' });
    expect(result.job.type).toBe('READING_GENERATION');
    expect(tx.order.update).toHaveBeenCalledTimes(1);

    const update = tx.order.update.mock.calls[0][0];
    expect(update.data).not.toHaveProperty('status');
    expect(update.data.expertPrompt).toBe('Conserver un ton clair');
    expect(update.data.expertReview).toMatchObject({
      assignedBy: expert.id,
      legacyField: 'preserved',
      production: {
        type: 'READING_GENERATION',
        status: 'QUEUED',
        attempts: 0,
      },
    });
  });

  it('rejects a second active production job for the same order', async () => {
    const { service, tx } = createService({
      id: 'order-1',
      orderNumber: 'LUM-1',
      status: 'PAID',
      expertPrompt: null,
      expertInstructions: null,
      errorLog: null,
      expertReview: {
        assignedBy: expert.id,
        production: {
          id: 'prod-active',
          orderId: 'order-1',
          orderNumber: 'LUM-1',
          type: 'READING_GENERATION',
          status: 'RUNNING',
          stage: 'GENERATING_READING',
          attempts: 1,
          maxAttempts: 3,
          requestedByExpertId: expert.id,
          queuedAt: '2026-07-17T10:00:00.000Z',
        },
      },
    });

    await expect(service.enqueueReading('order-1', expert)).rejects.toThrow(
      'Un traitement est déjà actif',
    );
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('does not allow a non-admin expert to act on another expert assignment', async () => {
    const { service, tx } = createService({
      id: 'order-1',
      orderNumber: 'LUM-1',
      status: 'PAID',
      expertPrompt: null,
      expertInstructions: null,
      errorLog: null,
      expertReview: { assignedBy: 'expert-2' },
    });

    await expect(service.enqueueReading('order-1', expert)).rejects.toThrow(
      'assignée à un autre expert',
    );
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('recovers an abandoned running job by requeueing it', async () => {
    const staleJob = {
      id: 'prod-stale',
      orderId: 'order-1',
      orderNumber: 'LUM-1',
      type: 'READING_GENERATION',
      status: 'RUNNING',
      stage: 'GENERATING_READING',
      attempts: 1,
      maxAttempts: 3,
      requestedByExpertId: expert.id,
      queuedAt: '2026-07-17T08:00:00.000Z',
      startedAt: '2026-07-17T08:00:00.000Z',
      heartbeatAt: '2026-07-17T08:00:00.000Z',
    };
    const { service, prisma } = createService({});
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        status: 'PROCESSING',
        expertReview: { production: staleJob },
      },
    ]);
    prisma.order.update.mockResolvedValue({});
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-17T09:00:00.000Z').getTime());

    const recovered = await service.recoverStaleJobs(true);

    expect(recovered).toBe(1);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        expertReview: expect.objectContaining({
          production: expect.objectContaining({
            id: 'prod-stale',
            status: 'QUEUED',
            stage: 'RECOVERED_AFTER_RESTART',
          }),
        }),
      }),
    });
  });
});
