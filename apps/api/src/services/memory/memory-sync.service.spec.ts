import { NotFoundException } from '@nestjs/common';
import { MemoryBankError } from './memory.types';
import { MemorySyncService } from './memory-sync.service';

describe('MemorySyncService', () => {
  function setup() {
    const prisma = {
      memorySyncJob: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      readingVersion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const config = {
      isEnabled: jest.fn().mockReturnValue(true),
      maxAttempts: jest.fn().mockReturnValue(9),
      staleMs: jest.fn().mockReturnValue(60_000),
    };
    return { service: new MemorySyncService(prisma as never, config as never), prisma, config };
  }

  it('cancels terminal errors without scheduling automatic retries', async () => {
    const { service, prisma } = setup();

    await service.fail(
      { id: 'job-a', attempts: 1, maxAttempts: 5 },
      new MemoryBankError('permission_denied', 'forbidden', false),
    );

    expect(prisma.memorySyncJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-a', status: 'RUNNING', attempts: 1 },
        data: expect.objectContaining({ status: 'CANCELLED', nextAttemptAt: null }),
      }),
    );
  });

  it('claims with the row maxAttempts and an atomic expected attempts value', async () => {
    const { service, prisma, config } = setup();
    prisma.memorySyncJob.findFirst.mockResolvedValue({
      id: 'job-a',
      status: 'FAILED',
      attempts: 2,
      maxAttempts: 3,
    });
    prisma.memorySyncJob.findUnique.mockResolvedValue({
      id: 'job-a',
      status: 'RUNNING',
      attempts: 3,
    });

    await expect(service.claimNext()).resolves.toEqual({
      id: 'job-a',
      status: 'RUNNING',
      attempts: 3,
    });

    expect(config.maxAttempts).not.toHaveBeenCalled();
    expect(prisma.memorySyncJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-a', status: 'FAILED', attempts: 2 } }),
    );
  });

  it('refuses a manual retry for a job belonging to another client', async () => {
    const { service, prisma } = setup();
    prisma.memorySyncJob.findUnique.mockResolvedValue({
      id: 'job-b',
      userId: 'user-b',
      status: 'CANCELLED',
    });

    await expect(service.retryForUser('job-b', 'user-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.memorySyncJob.update).not.toHaveBeenCalled();
  });

  it('backfills only missing SEALED versions without a Vertex call', async () => {
    const { service, prisma } = setup();
    prisma.readingVersion.findMany.mockResolvedValue([
      { id: 'version-a', orderId: 'order-a', contentHash: 'hash-a', order: { userId: 'user-a' } },
    ]);

    await expect(service.enqueueMissingJobs({ dryRun: true, limit: 10 })).resolves.toEqual(
      expect.objectContaining({
        enqueued: 0,
        candidates: [expect.objectContaining({ readingVersionId: 'version-a' })],
      }),
    );
    expect(prisma.memorySyncJob.create).not.toHaveBeenCalled();
    expect(prisma.readingVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SEALED', memorySyncJob: null }),
      }),
    );
  });
});
