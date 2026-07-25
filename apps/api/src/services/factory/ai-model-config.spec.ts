import {
  assertExecutableAgentModel,
  assertOperationalModel,
  assertSavableAgentModel,
  assertValidatedAgentCapabilities,
  cloneAiModelConfig,
  DEFAULT_AI_MODEL_CONFIG,
  estimateOpenAiCost,
  missingAgentCapabilities,
  modelSupportsAgent,
  normalizeAiModelConfig,
  supportsThinkingLevel,
  validateAiModelConfig,
} from './ai-model-config';

describe('ai-model-config', () => {
  it('accepts the canonical per-agent snapshot configuration', () => {
    const normalized = normalizeAiModelConfig(DEFAULT_AI_MODEL_CONFIG);
    expect(normalized.issues).toEqual([]);
    expect(normalized.config.providerMode).toBe('per_agent');
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('high');
    expect(normalized.config.agents.EDITOR.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.NARRATOR.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.CONFIDANT.enabled).toBe(false);
    expect(normalized.config.agents.ONIRIQUE.enabled).toBe(false);
  });

  it('strips legacy temperature, topP, and reasoningEffort from historical stored JSON', () => {
    const historicalInput = {
      temperature: 0.7,
      topP: 0.9,
      reasoningEffort: 'high',
    };
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-5.5-2026-04-23',
          maxOutputTokens: 24000,
          ...historicalInput,
        },
      },
    });

    const scribe = normalized.config.agents.SCRIBE;
    expect(scribe.thinkingLevel).toBe('high');
    expect((scribe as any).temperature).toBeUndefined();
    expect((scribe as any).topP).toBeUndefined();
    expect((scribe as any).reasoningEffort).toBeUndefined();
  });

  it('normalizes gpt-5.4 without level to none', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
          maxOutputTokens: 24000,
        },
      },
    });
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('none');
  });

  it('normalizes gpt-5.5 without level to medium', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-5.5-2026-04-23',
          maxOutputTokens: 24000,
        },
      },
    });
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('medium');
  });

  it('normalizes gemini-3.6-flash without level to medium', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'gemini',
          model: 'gemini-3.6-flash',
          maxOutputTokens: 24000,
        },
      },
    });
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('medium');
  });

  it('corrects an incompatible thinkingLevel to defaultthinkingLevel', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'vertex',
          model: 'gemini-3.1-pro',
          thinkingLevel: 'minimal' as any,
          maxOutputTokens: 24000,
        },
      },
    });
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('high');
  });

  it('unknown models do not receive speculative thinking controls', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'some-unknown-model',
          thinkingLevel: 'high' as any,
          maxOutputTokens: 24000,
        },
      },
    });
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBeUndefined();
  });

  describe('assertExecutableAgentModel', () => {
    it('gpt-5.4 accepts none, low, medium, high, xhigh and rejects minimal', () => {
      for (const level of ['none', 'low', 'medium', 'high', 'xhigh'] as const) {
        expect(() =>
          assertExecutableAgentModel({
            agent: 'SCRIBE',
            provider: 'openai',
            model: 'gpt-5.4-2026-03-05',
            thinkingLevel: level,
          }),
        ).not.toThrow();
      }
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
          thinkingLevel: 'minimal' as any,
        }),
      ).toThrow();
    });

    it('gpt-4o is executable without thinkingLevel and rejects any provided thinkingLevel', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'CONFIDANT',
          provider: 'openai',
          model: 'gpt-4o-2024-11-20',
        }),
      ).not.toThrow();

      expect(() =>
        assertExecutableAgentModel({
          agent: 'CONFIDANT',
          provider: 'openai',
          model: 'gpt-4o-2024-11-20',
          thinkingLevel: 'high',
        }),
      ).toThrow(/ne supporte pas un niveau de réflexion/);
    });

    it('gemini-3.6-flash accepts minimal, low, medium, high and rejects none / xhigh', () => {
      for (const level of ['minimal', 'low', 'medium', 'high'] as const) {
        expect(() =>
          assertExecutableAgentModel({
            agent: 'SCRIBE',
            provider: 'gemini',
            model: 'gemini-3.6-flash',
            thinkingLevel: level,
          }),
        ).not.toThrow();
      }
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'gemini',
          model: 'gemini-3.6-flash',
          thinkingLevel: 'none' as any,
        }),
      ).toThrow();
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'gemini',
          model: 'gemini-3.6-flash',
          thinkingLevel: 'xhigh' as any,
        }),
      ).toThrow();
    });

    it('gemini-3.1-pro accepts low, medium, high and rejects minimal', () => {
      for (const level of ['low', 'medium', 'high'] as const) {
        expect(() =>
          assertExecutableAgentModel({
            agent: 'SCRIBE',
            provider: 'vertex',
            model: 'gemini-3.1-pro',
            thinkingLevel: level,
          }),
        ).not.toThrow();
      }
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'vertex',
          model: 'gemini-3.1-pro',
          thinkingLevel: 'minimal' as any,
        }),
      ).toThrow();
    });

    it('gemini-3-pro accepts only low and high', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'gemini',
          model: 'gemini-3-pro',
          thinkingLevel: 'low',
        }),
      ).not.toThrow();
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'gemini',
          model: 'gemini-3-pro',
          thinkingLevel: 'high',
        }),
      ).not.toThrow();
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'gemini',
          model: 'gemini-3-pro',
          thinkingLevel: 'medium' as any,
        }),
      ).toThrow();
    });

    it('gemini-2.5-flash is executable without thinkingLevel', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
        }),
      ).not.toThrow();
    });
  });
});
