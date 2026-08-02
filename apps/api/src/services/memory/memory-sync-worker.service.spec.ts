import { MemorySyncWorkerService } from './memory-sync-worker.service';

describe('MemorySyncWorkerService', () => {
  function setup() {
    const config = {
      isWorkerEnabled: jest.fn().mockReturnValue(true),
      isWriteEnabled: jest.fn().mockReturnValue(true),
      pollMs: jest.fn().mockReturnValue(5_000),
      concurrency: jest.fn().mockReturnValue(1),
      pendingMutationLimit: jest.fn().mockReturnValue(10),
      heartbeatMs: jest.fn().mockReturnValue(1_000),
    };
    const readiness = { getStatus: jest.fn().mockResolvedValue({ ready: true, code: 'ready' }) };
    const sync = {
      recoverStaleJobs: jest.fn().mockResolvedValue(undefined),
      enqueueRecentMissingJobs: jest.fn().mockResolvedValue({ enqueued: 0 }),
      enqueueMissingJobs: jest.fn(),
      claimNext: jest.fn().mockResolvedValue(null),
      heartbeat: jest.fn().mockResolvedValue(undefined),
      succeed: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = { readingVersion: { findUnique: jest.fn() } };
    const userMemory = {
      persistSealedCandidates: jest.fn().mockResolvedValue({ accepted: 0, active: 0 }),
      syncActiveForReading: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
      convergePendingMutations: jest.fn().mockResolvedValue({ processed: 0, failed: 0 }),
    };
    const oracle = { extractMemoryCandidates: jest.fn().mockResolvedValue([]) };
    const service = new MemorySyncWorkerService(
      config as never,
      readiness as never,
      sync as never,
      prisma as never,
      userMemory as never,
      oracle as never,
    );
    return { service, config, readiness, sync, prisma, userMemory, oracle };
  }

  afterEach(() => jest.useRealTimers());

  it('does not start when disabled and clears its interval on shutdown', () => {
    jest.useFakeTimers();
    const { service, config } = setup();
    config.isWorkerEnabled.mockReturnValue(false);

    service.onModuleInit();
    expect(jest.getTimerCount()).toBe(0);

    config.isWorkerEnabled.mockReturnValue(true);
    service.onModuleInit();
    expect(jest.getTimerCount()).toBe(1);
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not recover, scan, claim, or fail a job while MEMORY is not ready', async () => {
    const { service, readiness, sync, userMemory } = setup();
    readiness.getStatus.mockResolvedValue({ ready: false, code: 'memory_validation_missing' });

    await (service as unknown as { tick(): Promise<void> }).tick();

    expect(sync.recoverStaleJobs).not.toHaveBeenCalled();
    expect(sync.enqueueRecentMissingJobs).not.toHaveBeenCalled();
    expect(sync.claimNext).not.toHaveBeenCalled();
    expect(sync.fail).not.toHaveBeenCalled();
    expect(userMemory.convergePendingMutations).not.toHaveBeenCalled();
  });

  it('prevents simultaneous ticks and only invokes the recent recovery scan', async () => {
    const { service, readiness, sync } = setup();
    let release!: (value: { ready: boolean; code: string }) => void;
    readiness.getStatus.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const first = (service as unknown as { tick(): Promise<void> }).tick();
    const second = (service as unknown as { tick(): Promise<void> }).tick();
    release({ ready: true, code: 'ready' });
    await Promise.all([first, second]);

    expect(readiness.getStatus).toHaveBeenCalledTimes(2); // tick + one process slot
    expect(sync.enqueueRecentMissingJobs).toHaveBeenCalledTimes(1);
    expect(sync.enqueueMissingJobs).not.toHaveBeenCalled();
  });

  it('converges bounded pending mutations after reading jobs only when writing is enabled', async () => {
    const { service, config, sync, userMemory } = setup();

    await (service as unknown as { tick(): Promise<void> }).tick();

    expect(userMemory.convergePendingMutations).toHaveBeenCalledWith(10);
    expect(sync.claimNext.mock.invocationCallOrder[0]).toBeLessThan(
      userMemory.convergePendingMutations.mock.invocationCallOrder[0],
    );

    userMemory.convergePendingMutations.mockClear();
    config.isWriteEnabled.mockReturnValue(false);
    await (service as unknown as { tick(): Promise<void> }).tick();
    expect(userMemory.convergePendingMutations).not.toHaveBeenCalled();
  });

  it('claims, heartbeats and completes a valid sealed job', async () => {
    const { service, sync, prisma, userMemory, oracle } = setup();
    sync.claimNext.mockResolvedValue({
      id: 'job-a',
      readingVersionId: 'version-a',
      userId: 'user-a',
      orderId: 'order-a',
      contentHash: 'hash-a',
      attempts: 1,
      maxAttempts: 5,
    });
    prisma.readingVersion.findUnique.mockResolvedValue({
      status: 'SEALED',
      contentHash: 'hash-a',
      content: { safe: 'sealed' },
      order: { userId: 'user-a' },
    });
    oracle.extractMemoryCandidates.mockResolvedValue([{ fact: 'safe' }]);
    userMemory.persistSealedCandidates.mockResolvedValue({ accepted: 1, active: 1 });
    userMemory.syncActiveForReading.mockResolvedValue({ synced: 1, failed: 0 });

    await (service as unknown as { processOne(): Promise<void> }).processOne();

    expect(sync.heartbeat).toHaveBeenCalledWith('job-a');
    expect(sync.succeed).toHaveBeenCalledWith(
      'job-a',
      expect.objectContaining({ candidateCount: 1, synced: 1 }),
    );
  });

  it('keeps a long extraction claimed with periodic heartbeats and clears the timer', async () => {
    jest.useFakeTimers();
    const { service, sync, prisma, oracle } = setup();
    sync.claimNext.mockResolvedValue({
      id: 'job-a',
      readingVersionId: 'version-a',
      userId: 'user-a',
      orderId: 'order-a',
      contentHash: 'hash-a',
      attempts: 1,
      maxAttempts: 5,
    });
    prisma.readingVersion.findUnique.mockResolvedValue({
      status: 'SEALED',
      contentHash: 'hash-a',
      content: { safe: 'sealed' },
      order: { userId: 'user-a' },
    });
    let release!: (value: unknown[]) => void;
    oracle.extractMemoryCandidates.mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        release = resolve;
      }),
    );

    const processing = (service as unknown as { processOne(): Promise<void> }).processOne();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(3_000);

    expect(sync.heartbeat).toHaveBeenCalledTimes(4);
    release([]);
    await processing;
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    [8, 'quota'],
    [7, 'permission_denied'],
  ])('classifies provider code %s as %s before failing the job', async (code, expected) => {
    const { service, sync, prisma, oracle } = setup();
    sync.claimNext.mockResolvedValue({
      id: 'job-a',
      readingVersionId: 'version-a',
      userId: 'user-a',
      orderId: 'order-a',
      contentHash: 'hash-a',
      attempts: 1,
      maxAttempts: 5,
    });
    prisma.readingVersion.findUnique.mockResolvedValue({
      status: 'SEALED',
      contentHash: 'hash-a',
      content: {},
      order: { userId: 'user-a' },
    });
    oracle.extractMemoryCandidates.mockRejectedValue(
      Object.assign(new Error('provider failure'), { code }),
    );

    await (service as unknown as { processOne(): Promise<void> }).processOne();

    expect(sync.fail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-a' }),
      expect.objectContaining({ code: expected, retryable: expected === 'quota' }),
    );
  });
});
