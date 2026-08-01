import { MemoryContextBuilder } from './memory-context-builder.service';

describe('MemoryContextBuilder', () => {
  const config = { isReadEnabled: jest.fn().mockReturnValue(true) };

  beforeEach(() => jest.clearAllMocks());

  it('orders only locally ACTIVE facts returned by Vertex relevance and caps the context', async () => {
    const prisma = {
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

    const result = await service.build('user-a', 'Question');

    expect(result.indexOf('Repère local B')).toBeLessThan(result.indexOf('Repère local A'));
    expect(result).toContain('SOURCE SECONDAIRE');
    expect(prisma.userMemory.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { userId: 'user-a', status: 'ACTIVE' }, take: 8 }),
    );
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
