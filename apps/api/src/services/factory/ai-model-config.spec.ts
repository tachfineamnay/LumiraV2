import {
  assertOperationalModel,
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

  it('accepts per_agent mode with vertex and gemini models', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'vertex',
          model: 'gemini-2.5-pro',
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 24000,
        },
        EDITOR: {
          enabled: true,
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 16000,
        },
      },
    });

    expect(normalized.issues).toEqual([]);
    expect(normalized.config.providerMode).toBe('per_agent');
    expect(normalized.config.agents.SCRIBE.provider).toBe('vertex');
    expect(normalized.config.agents.SCRIBE.model).toBe('gemini-2.5-pro');
    expect(normalized.config.agents.EDITOR.provider).toBe('gemini');
    expect(normalized.config.agents.EDITOR.model).toBe('gemini-2.5-flash');
  });

  it('restores defaults for non-operational model ids such as gpt-3.5-pro', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'openai_only',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-3.5-pro',
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 8000,
        },
      },
    });

    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(normalized.issues).toContain(
      'SCRIBE: modèle gpt-3.5-pro non opérationnel, gpt-5.5-2026-04-23 restauré',
    );
  });

  it('accepts pinned V1 OpenAI snapshots only', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'openai_only',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-4o-2024-11-20',
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 8000,
        },
      },
    });

    expect(normalized.issues).toEqual([]);
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-4o-2024-11-20');
  });

  it('assertOperationalModel rejects phantom ids', () => {
    expect(() => assertOperationalModel('openai', 'gpt-3.5-pro', 'SCRIBE')).toThrow(
      /\[SCRIBE\] modèle non opérationnel: gpt-3\.5-pro/,
    );
    expect(() => assertOperationalModel('openai', 'gpt-5.5-2026-04-23')).not.toThrow();
  });

  it('restores safe defaults for unknown mode and empty models', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'comparison',
      agents: {
        SCRIBE: {
          enabled: true,
          provider: 'gemini',
          model: '   ',
          maxOutputTokens: -1,
        },
      },
    });

    expect(normalized.usedFallback).toBe(true);
    expect(normalized.config.providerMode).toBe('openai_only');
    expect(normalized.config.agents.SCRIBE.provider).toBe('openai');
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(normalized.config.agents.SCRIBE.maxOutputTokens).toBe(24000);
  });

  it('rejects invalid configuration in strict validation mode', () => {
    expect(() => validateAiModelConfig({ providerMode: 'comparison' })).toThrow();
  });

  it('estimates alias and pinned snapshot costs consistently', () => {
    expect(estimateOpenAiCost('gpt-5.5', 1000, 1000)).toBeCloseTo(0.035, 6);
    expect(estimateOpenAiCost('gpt-5.5-2026-04-23', 1000, 1000)).toBeCloseTo(0.035, 6);
    expect(estimateOpenAiCost('gpt-4o-2024-11-20', 1000, 1000)).toBeCloseTo(0.0125, 6);
    expect(estimateOpenAiCost('unknown-model', 1000, 1000)).toBeUndefined();
  });
});
