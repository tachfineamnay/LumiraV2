import { VertexMemoryBankClient } from './vertex-memory-bank.client';

describe('VertexMemoryBankClient deletion', () => {
  function setup() {
    const memoryConfig = {
      parent: jest.fn().mockReturnValue('projects/test/locations/global/reasoningEngines/lumira'),
      assertParent: jest
        .fn()
        .mockReturnValue('projects/test/locations/global/reasoningEngines/lumira'),
      requestTimeoutMs: jest.fn().mockReturnValue(1_000),
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
      deleteMemory: jest
        .fn()
        .mockResolvedValue([
          {
            promise: jest
              .fn()
              .mockRejectedValue(Object.assign(new Error('not found'), { code: 5 })),
          },
        ]),
    };

    await expect(
      service.deleteMemory(
        'projects/test/locations/global/reasoningEngines/lumira/memories/memory-a',
      ),
    ).resolves.toBeUndefined();
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
