import { VertexMemoryBankClient } from './vertex-memory-bank.client';

describe('VertexMemoryBankClient deletion', () => {
  function setup() {
    const memoryConfig = {
      parent: jest.fn().mockReturnValue('projects/test/locations/global/reasoningEngines/lumira'),
      assertParent: jest
        .fn()
        .mockReturnValue('projects/test/locations/global/reasoningEngines/lumira'),
      requestTimeoutMs: jest.fn().mockReturnValue(1_000),
      lroTimeoutMs: jest.fn().mockReturnValue(60_000),
      isEnabled: jest.fn().mockReturnValue(true),
    };
    const service = new VertexMemoryBankClient(
      { systemSetting: { findUnique: jest.fn() } } as never,
      { get: jest.fn() } as never,
      memoryConfig as never,
    );
    return { service, memoryConfig };
  }

  it('treats NOT_FOUND as an idempotent completed deletion', async () => {
    const { service } = setup();
    (service as unknown as { client: unknown }).client = {
      deleteMemory: jest.fn().mockResolvedValue([
        {
          promise: jest.fn().mockRejectedValue(Object.assign(new Error('not found'), { code: 5 })),
        },
      ]),
    };

    await expect(
      service.deleteMemory(
        'projects/test/locations/global/reasoningEngines/lumira/memories/memory-a',
      ),
    ).resolves.toBeUndefined();
  });

  it('passes a caller-supplied stable memoryId to Vertex and validates the result scope', async () => {
    const { service } = setup();
    const createMemory = jest.fn().mockResolvedValue([
      {
        promise: jest.fn().mockResolvedValue([
          {
            name: 'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-abc123',
            fact: 'Fait prudent',
            scope: { user_id: 'user-a' },
          },
        ]),
      },
    ]);
    (service as unknown as { client: unknown }).client = { createMemory };

    await expect(
      service.createMemory({
        memoryId: 'lumira-abc123',
        userId: 'user-a',
        fact: 'Fait prudent',
        category: 'PREFERENCE',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ name: expect.stringContaining('/lumira-abc123') }),
    );
    expect(createMemory).toHaveBeenCalledWith(
      expect.objectContaining({ memoryId: 'lumira-abc123' }),
      { timeout: 1_000 },
    );
  });

  it('reconciles ALREADY_EXISTS by reading the deterministic resource', async () => {
    const { service } = setup();
    const getMemory = jest.fn().mockResolvedValue([
      {
        name: 'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-abc123',
        fact: 'Fait prudent',
        scope: { user_id: 'user-a' },
      },
    ]);
    (service as unknown as { client: unknown }).client = {
      createMemory: jest.fn().mockRejectedValue(Object.assign(new Error('exists'), { code: 6 })),
      getMemory,
    };

    await expect(
      service.createMemory({
        memoryId: 'lumira-abc123',
        userId: 'user-a',
        fact: 'Fait prudent',
        category: 'PREFERENCE',
      }),
    ).resolves.toEqual(expect.objectContaining({ scope: { user_id: 'user-a' } }));
    expect(getMemory).toHaveBeenCalledWith(
      { name: 'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-abc123' },
      { timeout: 1_000 },
    );
  });

  it('refuses an existing deterministic resource with a different user scope', async () => {
    const { service } = setup();
    (service as unknown as { client: unknown }).client = {
      createMemory: jest.fn().mockRejectedValue(Object.assign(new Error('exists'), { code: 6 })),
      getMemory: jest.fn().mockResolvedValue([
        {
          name: 'projects/test/locations/global/reasoningEngines/lumira/memories/lumira-abc123',
          fact: 'Fait prudent',
          scope: { user_id: 'user-b' },
        },
      ]),
    };

    await expect(
      service.createMemory({
        memoryId: 'lumira-abc123',
        userId: 'user-a',
        fact: 'Fait prudent',
        category: 'PREFERENCE',
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'invalid_argument' }));
  });

  it('uses a separate LRO deadline after the bounded create RPC', async () => {
    jest.useFakeTimers();
    const { service, memoryConfig } = setup();
    memoryConfig.lroTimeoutMs.mockReturnValue(1);
    (service as unknown as { client: unknown }).client = {
      createMemory: jest
        .fn()
        .mockResolvedValue([{ promise: jest.fn(() => new Promise(() => undefined)) }]),
    };

    const pending = service.createMemory({
      memoryId: 'lumira-abc123',
      userId: 'user-a',
      fact: 'Fait prudent',
      category: 'PREFERENCE',
    });
    const assertion = expect(pending).rejects.toEqual(expect.objectContaining({ code: 'timeout' }));
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1);

    await assertion;
    jest.useRealTimers();
  });

  it('deletes all paginated results and verifies with a second list', async () => {
    const { service } = setup();
    const list = jest
      .spyOn(service, 'listUserMemories')
      .mockResolvedValueOnce([
        {
          name: 'projects/test/locations/global/reasoningEngines/lumira/memories/a',
          fact: 'A',
          scope: { user_id: 'user-a' },
        },
        {
          name: 'projects/test/locations/global/reasoningEngines/lumira/memories/b',
          fact: 'B',
          scope: { user_id: 'user-a' },
        },
      ])
      .mockResolvedValueOnce([]);
    const remove = jest.spyOn(service, 'deleteMemory').mockResolvedValue(undefined);

    await expect(service.deleteAllUserMemories('user-a')).resolves.toBe(2);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
