import { NotFoundException } from '@nestjs/common';
import { MemoryBankError } from './memory.types';
import { UserMemoryService } from './user-memory.service';

describe('UserMemoryService ownership and purge', () => {
  function setup() {
    const prisma = {
      userMemory: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        createMany: jest.fn(),
        groupBy: jest.fn(),
      },
      user: { count: jest.fn().mockResolvedValue(0) },
    };
    const sanitizer = { sanitize: jest.fn(), hash: jest.fn() };
    const config = {
      isWriteEnabled: jest.fn().mockReturnValue(true),
      isAutoApproveEnabled: jest.fn(),
      diagnosticUsers: jest.fn(),
    };
    const bank = {
      isConfigured: jest.fn().mockResolvedValue(true),
      deleteMemory: jest.fn().mockResolvedValue(undefined),
      deleteAllUserMemories: jest.fn().mockResolvedValue(0),
      createMemory: jest.fn(),
      updateMemory: jest.fn(),
    };
    return {
      service: new UserMemoryService(
        prisma as never,
        sanitizer as never,
        config as never,
        bank as never,
      ),
      prisma,
      bank,
    };
  }

  it('does not allow a client-scoped action to target another client memory', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'memory-b',
      userId: 'user-b',
      category: 'PREFERENCE',
      status: 'ACTIVE',
      vertexMemoryName: 'remote-b',
    });

    await expect(service.delete('memory-b', 'user-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(bank.deleteMemory).not.toHaveBeenCalled();
  });

  it('holds a conflicting same-category extraction for ADMIN review instead of injecting it', async () => {
    const { service, prisma } = setup();
    (
      service as unknown as { sanitizer: { sanitize: jest.Mock; hash: jest.Mock } }
    ).sanitizer.sanitize.mockReturnValue([
      {
        category: 'LIFE_CONTEXT',
        fact: 'Un nouveau repère de vie prudent et suffisamment précis.',
        confidence: 0.95,
      },
    ]);
    (
      service as unknown as { sanitizer: { sanitize: jest.Mock; hash: jest.Mock } }
    ).sanitizer.hash.mockReturnValue('new-hash');
    prisma.userMemory.findMany.mockResolvedValue([
      { category: 'LIFE_CONTEXT', contentHash: 'old-hash' },
    ]);
    prisma.userMemory.createMany.mockResolvedValue({ count: 1 });

    await service.persistSealedCandidates({
      userId: 'user-a',
      readingVersionId: 'version-a',
      candidates: [],
    });

    expect(prisma.userMemory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ status: 'PENDING', lastSyncError: 'potential_conflict' })],
      }),
    );
  });

  it('persists a delete mutation before contacting Vertex, then finalizes it', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findUnique
      .mockResolvedValueOnce({
        id: 'memory-a',
        userId: 'user-a',
        category: 'PREFERENCE',
        status: 'ACTIVE',
        vertexMemoryName: 'remote-a',
      })
      .mockResolvedValueOnce({
        id: 'memory-a',
        userId: 'user-a',
        category: 'PREFERENCE',
        status: 'REJECTED',
        vertexMemoryName: 'remote-a',
        pendingOperation: 'DELETE',
      })
      .mockResolvedValueOnce({
        id: 'memory-a',
        status: 'REJECTED',
        syncedAt: null,
        vertexMemoryName: null,
        pendingOperation: null,
        lastSyncError: null,
      });

    await service.reject('memory-a', 'user-a', 'expert-a');

    expect(prisma.userMemory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', pendingOperation: 'DELETE' }),
      }),
    );
    expect(bank.deleteMemory).toHaveBeenCalledWith('remote-a');
    expect(prisma.userMemory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vertexMemoryName: null, pendingOperation: null }),
      }),
    );
    expect(prisma.userMemory.update.mock.invocationCallOrder[0]).toBeLessThan(
      bank.deleteMemory.mock.invocationCallOrder[0],
    );
  });

  it('blocks a purge when a local remote reference exists but Vertex is unavailable', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findMany.mockResolvedValue([{ vertexMemoryName: 'remote-a' }]);
    bank.isConfigured.mockResolvedValue(false);

    await expect(service.deleteRemoteForUser('user-a')).rejects.toEqual(
      expect.objectContaining({ code: 'not_configured' }),
    );
    expect(bank.deleteMemory).not.toHaveBeenCalled();
  });

  it('keeps a durable delete operation visible when remote deletion fails', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findUnique
      .mockResolvedValueOnce({
        id: 'memory-a',
        userId: 'user-a',
        category: 'PREFERENCE',
        status: 'ACTIVE',
        vertexMemoryName: 'remote-a',
      })
      .mockResolvedValueOnce({
        id: 'memory-a',
        userId: 'user-a',
        category: 'PREFERENCE',
        status: 'DELETED',
        vertexMemoryName: 'remote-a',
        pendingOperation: 'DELETE',
      });
    bank.deleteMemory.mockRejectedValue(new MemoryBankError('unavailable', 'offline', true));

    await expect(service.delete('memory-a', 'user-a')).rejects.toEqual(
      expect.objectContaining({ code: 'unavailable' }),
    );
    expect(prisma.userMemory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELETED', pendingOperation: 'DELETE' }),
      }),
    );
    expect(prisma.userMemory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSyncError: 'unavailable' }) }),
    );
  });

  it('uses the same non-personal deterministic Vertex id on a retry', async () => {
    const { service, prisma, bank } = setup();
    const local = {
      id: 'memory-local-a',
      userId: 'user-a',
      fact: 'Un fait prudent suffisamment détaillé.',
      category: 'PREFERENCE',
      status: 'SYNC_FAILED',
      vertexMemoryName: null,
      pendingOperation: 'UPSERT',
    };
    prisma.userMemory.findUnique.mockResolvedValue(local);
    bank.createMemory.mockResolvedValue({
      name: 'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-a',
      fact: local.fact,
      scope: { user_id: 'user-a' },
    });

    await service.syncMemory(local.id);
    await service.syncMemory(local.id);

    const ids = bank.createMemory.mock.calls.map((call) => call[0].memoryId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[0]).toMatch(/^lumira-[a-f0-9]{40}$/);
    expect(ids[0]).not.toContain('user-a');
  });

  it('requires an explicit conflict decision before approving a potential conflict', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'memory-a',
      userId: 'user-a',
      category: 'LIFE_CONTEXT',
      status: 'PENDING',
      vertexMemoryName: null,
      lastSyncError: 'potential_conflict',
    });

    await expect(service.approve('memory-a', 'user-a', 'expert-a', {})).rejects.toEqual(
      expect.objectContaining({ message: expect.stringMatching(/conflit potentiel/i) }),
    );
    expect(bank.createMemory).not.toHaveBeenCalled();
  });

  it('keeps Vertex resource names, content hashes and user ids out of the Desk payload', async () => {
    const { service, prisma } = setup();
    prisma.userMemory.findMany.mockResolvedValue([
      {
        id: 'memory-a',
        userId: 'user-a',
        sourceType: 'SEALED_READING',
        sourceVersionId: 'version-a',
        category: 'PREFERENCE',
        fact: 'Fait prudent pour le Desk.',
        status: 'ACTIVE',
        contentHash: 'secret-hash',
        vertexMemoryName:
          'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-a',
        confidence: 0.9,
        approvedAt: null,
        syncedAt: new Date(),
        lastSyncError: null,
        pendingOperation: null,
        conflictResolution: null,
        conflictResolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        readingVersion: null,
      },
    ]);

    const [memory] = await service.listForExpert('user-a');

    expect(memory).toEqual(expect.objectContaining({ vertexSynced: true }));
    expect(memory).not.toHaveProperty('vertexMemoryName');
    const select = prisma.userMemory.findMany.mock.calls[0][0].select;
    expect(select.contentHash).toBeUndefined();
    expect(select.userId).toBeUndefined();
  });

  it('executes the A/B/case diagnostic and always verifies cleanup', async () => {
    const { service, prisma, bank } = setup();
    (
      service as unknown as { memoryConfig: { diagnosticUsers: jest.Mock } }
    ).memoryConfig.diagnosticUsers.mockReturnValue({
      userAId: 'lumira-memory-test-a',
      userBId: 'lumira-memory-test-b',
    });
    prisma.user.count.mockResolvedValue(0);
    (bank as unknown as { listUserMemories: jest.Mock }).listUserMemories = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    bank.createMemory.mockResolvedValue({
      name: 'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-diag-a',
      fact: 'Diagnostic',
      scope: { user_id: 'lumira-memory-test-a' },
    });
    (bank as unknown as { retrieveMemories: jest.Mock }).retrieveMemories = jest
      .fn()
      .mockResolvedValueOnce([
        {
          name: 'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-diag-a',
          fact: 'Diagnostic',
          scope: { user_id: 'lumira-memory-test-a' },
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(service.runIsolationDiagnostic('canary')).resolves.toEqual({
      created: true,
      retrievedForA: true,
      absentFromB: true,
      absentFromCaseVariant: true,
      scopeBreakRejected: true,
      deleted: true,
      absentAfterDeletion: true,
    });
    expect(
      (bank as unknown as { retrieveMemories: jest.Mock }).retrieveMemories,
    ).toHaveBeenNthCalledWith(2, 'LUMIRA-MEMORY-TEST-A', expect.any(String), 8);
    expect(bank.deleteMemory).toHaveBeenCalledWith(
      'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-diag-a',
    );
  });

  it('keeps a legacy account with no memory trace purgeable', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findMany.mockResolvedValue([]);
    bank.isConfigured.mockResolvedValue(false);

    await expect(service.deleteRemoteForUser('user-a')).resolves.toEqual({ deleted: 0 });
  });
});
