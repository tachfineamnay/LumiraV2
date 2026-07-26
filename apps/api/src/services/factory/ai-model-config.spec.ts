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
  isOperationalThinkingModel,
  validateAiModelConfig,
} from './ai-model-config';

describe('ai-model-config (thinking-only production policy)', () => {
  it('accepts the canonical per-agent snapshot configuration with modern models', () => {
    const normalized = normalizeAiModelConfig(DEFAULT_AI_MODEL_CONFIG);
    expect(normalized.issues).toEqual([]);
    expect(normalized.config.providerMode).toBe('per_agent');
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('high');
    expect(normalized.config.agents.EDITOR.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.NARRATOR.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.CONFIDANT.enabled).toBe(false);
    expect(normalized.config.agents.CONFIDANT.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.ONIRIQUE.enabled).toBe(false);
    expect(normalized.config.agents.ONIRIQUE.model).toBe('gpt-5.4-2026-03-05');
  });

  it('strips legacy temperature, topP, verbosity, and reasoningEffort from stored JSON', () => {
    const historicalInput = {
      temperature: 0.7,
      topP: 0.9,
      verbosity: 'medium',
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
    expect((scribe as any).verbosity).toBeUndefined();
    expect((scribe as any).reasoningEffort).toBeUndefined();
  });

  it('normalizes gpt-5.4 without level to medium default', () => {
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
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('medium');
  });

  it('normalizes gemini-3.6-flash without level to medium default', () => {
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

  it('corrects an incompatible thinkingLevel to defaultThinkingLevel', () => {
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

  it('replaces none thinkingLevel with defaultThinkingLevel in production', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
          thinkingLevel: 'none' as any,
          maxOutputTokens: 24000,
        },
      },
    });
    expect(normalized.config.agents.SCRIBE.thinkingLevel).toBe('medium');
  });

  describe('assertExecutableAgentModel (strict thinking-only enforcement)', () => {
    it('1. GPT-4o is rejected', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'CONFIDANT',
          provider: 'openai',
          model: 'gpt-4o-2024-11-20',
          thinkingLevel: 'medium' as any,
        }),
      ).toThrow(/est interdit/);
    });

    it('2. GPT-4.1 is rejected', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'CONFIDANT',
          provider: 'openai',
          model: 'gpt-4.1-turbo',
          thinkingLevel: 'medium' as any,
        }),
      ).toThrow(/est interdit/);
    });

    it('3. Gemini 2.5 Pro is rejected', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'vertex',
          model: 'gemini-2.5-pro',
          thinkingLevel: 'high' as any,
        }),
      ).toThrow(/est interdit/);
    });

    it('4. Gemini 2.5 Flash is rejected', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
        }),
      ).toThrow(/est interdit/);
    });

    it('5. Unknown model is rejected', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'openai',
          model: 'some-unknown-model',
          thinkingLevel: 'high' as any,
        }),
      ).toThrow(/est interdit/);
    });

    it('6. thinkingLevel absent is rejected', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
        }),
      ).toThrow(/niveau de réflexion explicite est obligatoire/);
    });

    it('7. none is rejected in Lumira production', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
          thinkingLevel: 'none' as any,
        }),
      ).toThrow(/niveau none incompatible/);
    });

    it('8. GPT-5.4 accepts low, medium, high, xhigh', () => {
      for (const level of ['low', 'medium', 'high', 'xhigh'] as const) {
        expect(() =>
          assertExecutableAgentModel({
            agent: 'SCRIBE',
            provider: 'openai',
            model: 'gpt-5.4-2026-03-05',
            thinkingLevel: level,
          }),
        ).not.toThrow();
      }
    });

    it('9. GPT-5.5 accepts low, medium, high, xhigh', () => {
      for (const level of ['low', 'medium', 'high', 'xhigh'] as const) {
        expect(() =>
          assertExecutableAgentModel({
            agent: 'SCRIBE',
            provider: 'openai',
            model: 'gpt-5.5-2026-04-23',
            thinkingLevel: level,
          }),
        ).not.toThrow();
      }
    });

    it('10. Gemini 3.6 Flash accepts minimal, low, medium, high', () => {
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
    });

    it('11. Incompatible level is rejected', () => {
      expect(() =>
        assertExecutableAgentModel({
          agent: 'SCRIBE',
          provider: 'vertex',
          model: 'gemini-3.1-pro',
          thinkingLevel: 'minimal' as any,
        }),
      ).toThrow(/incompatible avec gemini-3.1-pro/);
    });
  });
});
