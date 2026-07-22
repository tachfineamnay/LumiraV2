import {
  DEFAULT_AI_MODEL_CONFIG,
  estimateOpenAiCost,
  normalizeAiModelConfig,
  validateAiModelConfig,
} from './ai-model-config';

describe('ai-model-config', () => {
  it('accepts the canonical OpenAI-only snapshot configuration', () => {
    const normalized = normalizeAiModelConfig(DEFAULT_AI_MODEL_CONFIG);
    expect(normalized.issues).toEqual([]);
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(normalized.config.agents.EDITOR.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.NARRATOR.model).toBe('gpt-4o-2024-11-20');
    expect(Object.values(normalized.config.agents).every((agent) => agent.enabled)).toBe(true);
  });

  it('restores safe pinned defaults for comparison mode, Gemini and unknown models', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'comparison',
      agents: {
        SCRIBE: {
          enabled: true,
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          maxOutputTokens: -1,
        },
      },
    });

    expect(normalized.usedFallback).toBe(true);
    expect(normalized.config.providerMode).toBe('openai_only');
    expect(normalized.config.agents.SCRIBE.provider).toBe('openai');
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(normalized.config.agents.SCRIBE.maxOutputTokens).toBe(24000);
    expect(normalized.config.agents.GUIDE.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.ONIRIQUE.enabled).toBe(true);
  });

  it('rejects aliases and invalid configuration in strict validation mode', () => {
    expect(() => validateAiModelConfig({ providerMode: 'comparison' })).toThrow();
    expect(() =>
      validateAiModelConfig({
        ...DEFAULT_AI_MODEL_CONFIG,
        agents: {
          ...DEFAULT_AI_MODEL_CONFIG.agents,
          SCRIBE: {
            ...DEFAULT_AI_MODEL_CONFIG.agents.SCRIBE,
            model: 'gpt-5.5',
          },
        },
      }),
    ).toThrow();
  });

  it('estimates alias and pinned snapshot costs consistently', () => {
    expect(estimateOpenAiCost('gpt-5.5', 1000, 1000)).toBeCloseTo(0.035, 6);
    expect(estimateOpenAiCost('gpt-5.5-2026-04-23', 1000, 1000)).toBeCloseTo(0.035, 6);
    expect(estimateOpenAiCost('gpt-4o-2024-11-20', 1000, 1000)).toBeCloseTo(0.0125, 6);
    expect(estimateOpenAiCost('unknown-model', 1000, 1000)).toBeUndefined();
  });
});
