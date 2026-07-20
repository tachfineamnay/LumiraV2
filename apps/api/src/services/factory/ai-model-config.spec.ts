import {
  DEFAULT_AI_MODEL_CONFIG,
  estimateOpenAiCost,
  normalizeAiModelConfig,
  validateAiModelConfig,
} from './ai-model-config';

describe('ai-model-config', () => {
  it('accepts the canonical OpenAI-only configuration', () => {
    const normalized = normalizeAiModelConfig(DEFAULT_AI_MODEL_CONFIG);
    expect(normalized.issues).toEqual([]);
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5');
    expect(normalized.config.agents.CONFIDANT.enabled).toBe(false);
  });

  it('restores safe defaults for comparison mode, Gemini and unknown models', () => {
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
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5');
    expect(normalized.config.agents.SCRIBE.maxOutputTokens).toBe(24000);
    expect(normalized.config.agents.GUIDE.model).toBe('gpt-5.4');
  });

  it('rejects invalid configuration in strict validation mode', () => {
    expect(() => validateAiModelConfig({ providerMode: 'comparison' })).toThrow();
  });

  it('estimates alias and pinned snapshot costs', () => {
    expect(estimateOpenAiCost('gpt-5.5', 1000, 1000)).toBeCloseTo(0.035, 6);
    expect(estimateOpenAiCost('gpt-5.5-2026-04-23', 1000, 1000)).toBeCloseTo(0.035, 6);
    expect(estimateOpenAiCost('unknown-model', 1000, 1000)).toBeUndefined();
  });
});
