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
    };
    const sanitizer = { sanitize: jest.fn(), hash: jest.fn() };
    const config = {
      isWriteEnabled: jest.fn().mockReturnValue(true),
      isAutoApproveEnabled: jest.fn(),
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

  it('deletes the remote copy before marking a rejected memory locally', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'memory-a',
      userId: 'user-a',
      category: 'PREFERENCE',
      status: 'ACTIVE',
      vertexMemoryName: 'remote-a',
    });
    prisma.userMemory.update.mockResolvedValue({
      id: 'memory-a',
      userId: 'user-a',
      status: 'REJECTED',
    });

    await service.reject('memory-a', 'user-a', 'expert-a');

    expect(bank.deleteMemory).toHaveBeenCalledWith('remote-a');
    expect(prisma.userMemory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', vertexMemoryName: null }),
      }),
    );
    expect(bank.deleteMemory.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.userMemory.update.mock.invocationCallOrder[0],
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

  it('does not clear the local Vertex name when remote deletion fails', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'memory-a',
      userId: 'user-a',
      category: 'PREFERENCE',
      status: 'ACTIVE',
      vertexMemoryName: 'remote-a',
    });
    bank.deleteMemory.mockRejectedValue(new MemoryBankError('unavailable', 'offline', true));

    await expect(service.delete('memory-a', 'user-a')).rejects.toEqual(
      expect.objectContaining({ code: 'unavailable' }),
    );
    expect(prisma.userMemory.update).not.toHaveBeenCalled();
  });

  it('keeps a legacy account with no memory trace purgeable', async () => {
    const { service, prisma, bank } = setup();
    prisma.userMemory.findMany.mockResolvedValue([]);
    bank.isConfigured.mockResolvedValue(false);

    await expect(service.deleteRemoteForUser('user-a')).resolves.toEqual({ deleted: 0 });
  });
});
