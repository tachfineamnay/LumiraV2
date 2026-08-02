import { MemoryContextBuilder } from './memory-context-builder.service';

describe('MemoryContextBuilder', () => {
  const config = { isReadEnabled: jest.fn().mockReturnValue(true) };

  beforeEach(() => jest.clearAllMocks());

  it('orders only fully synchronized local facts returned by Vertex relevance and caps the context', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      userMemory: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'a', fact: 'Repère local A suffisamment détaillé.', vertexMemoryName: 'mem-a' },
            { id: 'b', fact: 'Repère local B suffisamment détaillé.', vertexMemoryName: 'mem-b' },
          ])
          .mockResolvedValueOnce([
            { fact: 'Repère local A suffisamment détaillé.', vertexMemoryName: 'mem-a' },
            { fact: 'Repère local B suffisamment détaillé.', vertexMemoryName: 'mem-b' },
          ]),
      },
    };
    const bank = {
      retrieveMemories: jest.fn().mockResolvedValue([
        { name: 'mem-b', fact: 'remote B', scope: { user_id: 'user-a' } },
        { name: 'mem-a', fact: 'remote A', scope: { user_id: 'user-a' } },
      ]),
    };
    const service = new MemoryContextBuilder(config as never, prisma as never, bank as never);

    const sensitiveQuestion =
      'Mon diagnostic médical et mon téléphone 0612345678 doivent-ils changer ?';
    const result = await service.build('user-a', sensitiveQuestion);

    expect(result.indexOf('Repère local B')).toBeLessThan(result.indexOf('Repère local A'));
    expect(result).toContain('SOURCE SECONDAIRE');
    expect(prisma.userMemory.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          userId: 'user-a',
          status: 'ACTIVE',
          pendingOperation: null,
          vertexMemoryName: { not: null },
          syncedAt: { not: null },
          lastSyncError: null,
        },
        take: 8,
      }),
    );
    expect(bank.retrieveMemories).toHaveBeenCalledWith(
      'user-a',
      'continuité de la lecture actuelle',
      8,
    );
    expect(bank.retrieveMemories).not.toHaveBeenCalledWith('user-a', sensitiveQuestion, 8);
  });

  it.each([
    [
      'PostgreSQL',
      () => ({ userMemory: { findMany: jest.fn().mockRejectedValue(new Error('db down')) } }),
      { retrieveMemories: jest.fn() },
    ],
    [
      'Vertex',
      () => ({
        $queryRaw: jest.fn().mockResolvedValue([]),
        userMemory: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'a', fact: 'Repère local robuste.', vertexMemoryName: 'mem-a' },
            ]),
        },
      }),
      { retrieveMemories: jest.fn().mockRejectedValue(new Error('timeout')) },
    ],
  ])('fails open for %s errors', async (_source, createPrisma, bank) => {
    const service = new MemoryContextBuilder(
      config as never,
      createPrisma() as never,
      bank as never,
    );
    const result = await service.build('user-a');

    expect(typeof result).toBe('string');
    if (_source === 'PostgreSQL') expect(result).toBe('');
    else expect(result).toContain('Repère local robuste.');
  });
});
