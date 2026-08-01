import { DEFAULT_AI_MODEL_CONFIG } from '../factory/ai-model-config';
import { MemoryReadinessService } from './memory-readiness.service';

describe('MemoryReadinessService', () => {
  function setup(value?: unknown) {
    const prisma = {
      promptVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValue(value === undefined ? null : { value: JSON.stringify(value) }),
      },
    };
    const config = { isEnabled: jest.fn().mockReturnValue(true) };
    return {
      service: new MemoryReadinessService(prisma as never, config as never),
      prisma,
      config,
    };
  }

  function readyConfig() {
    const modelConfig = structuredClone(DEFAULT_AI_MODEL_CONFIG);
    modelConfig.agents.MEMORY = {
      ...modelConfig.agents.MEMORY,
      enabled: true,
      provider: 'vertex',
      validation: {
        provider: 'vertex',
        model: modelConfig.agents.MEMORY.model,
        checkedAt: '2026-08-01T00:00:00.000Z',
        probeVersion: 1,
        capabilities: { text: true, vision: false, structured: true },
      },
    };
    return modelConfig;
  }

  it('requires enabled Vertex MEMORY with verified text and structured output', async () => {
    const { service } = setup(readyConfig());

    await expect(service.getStatus()).resolves.toEqual({ ready: true, code: 'ready' });
  });

  it('blocks an unvalidated MEMORY agent', async () => {
    const config = readyConfig();
    delete config.agents.MEMORY.validation;
    const { service } = setup(config);

    await expect(service.getStatus()).resolves.toEqual({
      ready: false,
      code: 'memory_validation_missing',
    });
  });

  it('blocks a configuration that would force MEMORY away from Vertex', async () => {
    const config = readyConfig();
    config.providerMode = 'openai_only';
    const { service } = setup(config);

    await expect(service.getStatus()).resolves.toEqual({
      ready: false,
      code: 'provider_mode_invalid',
    });
  });
});
