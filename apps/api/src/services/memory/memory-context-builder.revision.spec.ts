import { MemoryContextBuilder } from './memory-context-builder.service';

describe('MemoryContextBuilder revision isolation', () => {
  it('excludes every memory sourced from the exact effective order being revised', async () => {
    const userMemoryFindMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'memory-other-order',
          fact: 'Continuité venant d’une autre commande.',
          vertexMemoryName: 'vertex/other',
          sourceVersionId: 'rv-other',
        },
      ])
      .mockResolvedValueOnce([]);
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'order-revised' }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({ id: 'order-revised' }),
      },
      readingVersion: {
        findMany: jest.fn().mockResolvedValue([{ id: 'rv-v1' }, { id: 'rv-working' }]),
      },
      userMemory: { findMany: userMemoryFindMany },
    };
    const bank = { retrieveMemories: jest.fn().mockResolvedValue([]) };
    const config = { isReadEnabled: jest.fn().mockReturnValue(true) };
    const builder = new MemoryContextBuilder(config as never, prisma as never, bank as never);

    const context = await builder.build('user-1', 'question privée');

    expect(context).toContain('Continuité venant d’une autre commande.');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { id: 'order-revised', userId: 'user-1' },
      select: { id: true },
    });
    const firstWhere = userMemoryFindMany.mock.calls[0][0].where;
    expect(firstWhere).toMatchObject({
      userId: 'user-1',
      status: 'ACTIVE',
      OR: [
        { sourceVersionId: null },
        { sourceVersionId: { notIn: ['rv-v1', 'rv-working'] } },
      ],
    });
    expect(bank.retrieveMemories).toHaveBeenCalledWith(
      'user-1',
      'continuité de la lecture actuelle',
      8,
    );
    expect(bank.retrieveMemories).not.toHaveBeenCalledWith(
      expect.anything(),
      'question privée',
      expect.anything(),
    );
  });

  it('keeps normal memory behavior when no effective revision is active', async () => {
    const userMemoryFindMany = jest.fn().mockResolvedValue([
      {
        id: 'memory-1',
        fact: 'Repère validé.',
        vertexMemoryName: 'vertex/1',
        sourceVersionId: 'rv-old-order',
      },
    ]);
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      order: { findFirst: jest.fn() },
      readingVersion: { findMany: jest.fn() },
      userMemory: { findMany: userMemoryFindMany },
    };
    const builder = new MemoryContextBuilder(
      { isReadEnabled: () => true } as never,
      prisma as never,
      { retrieveMemories: jest.fn().mockResolvedValue([]) } as never,
    );

    const context = await builder.build('user-1');

    expect(context).toContain('Repère validé.');
    expect(userMemoryFindMany.mock.calls[0][0].where.OR).toBeUndefined();
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
    expect(prisma.readingVersion.findMany).not.toHaveBeenCalled();
  });
});
