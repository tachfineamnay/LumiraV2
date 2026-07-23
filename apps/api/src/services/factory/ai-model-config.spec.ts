import {
  assertOperationalModel,
  assertSavableAgentModel,
  DEFAULT_AI_MODEL_CONFIG,
  estimateOpenAiCost,
  missingAgentCapabilities,
  modelSupportsAgent,
  normalizeAiModelConfig,
  validateAiModelConfig,
} from './ai-model-config';

describe('ai-model-config', () => {
  it('accepts the canonical per-agent snapshot configuration', () => {
    const normalized = normalizeAiModelConfig(DEFAULT_AI_MODEL_CONFIG);
    expect(normalized.issues).toEqual([]);
    expect(normalized.config.providerMode).toBe('per_agent');
    expect(normalized.config.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(normalized.config.agents.EDITOR.model).toBe('gpt-5.4-2026-03-05');
    expect(normalized.config.agents.NARRATOR.model).toBe('gpt-4o-2024-11-20');
    expect(normalized.config.agents.CONFIDANT.enabled).toBe(false);
    expect(normalized.config.agents.ONIRIQUE.enabled).toBe(false);
  });

  it('accepts per_agent mode with vertex and gemini models', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'vertex',
          model: 'gemini-3.5-flash',
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 24000,
        },
        EDITOR: {
          enabled: true,
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 16000,
        },
      },
    });

    expect(normalized.issues).toEqual([]);
    expect(normalized.config.agents.SCRIBE.provider).toBe('vertex');
    expect(normalized.config.agents.SCRIBE.model).toBe('gemini-3.5-flash');
    expect(normalized.config.agents.EDITOR.provider).toBe('gemini');
  });

  it('keeps dynamically discovered model ids without allowlist rejection', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'openai',
          model: 'custom-model-id',
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 8000,
        },
      },
    });
    expect(normalized.config.agents.SCRIBE.model).toBe('custom-model-id');
  });

  it('never replaces an explicitly empty model with a default model', () => {
    const normalized = normalizeAiModelConfig({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          enabled: true,
          provider: 'gemini',
          model: '   ',
          maxOutputTokens: 24000,
          temperature: 0.4,
          topP: 0.9,
        },
      },
    });

    expect(normalized.usedFallback).toBe(true);
    expect(normalized.config.agents.SCRIBE.provider).toBe('gemini');
    expect(normalized.config.agents.SCRIBE.model).toBe('');
    expect(normalized.issues.join(' ')).toContain('sélection manuelle requise');
    expect(() =>
      assertSavableAgentModel(
        'SCRIBE',
        normalized.config.agents.SCRIBE.provider,
        normalized.config.agents.SCRIBE.model,
      ),
    ).toThrow(/sélectionnez explicitement/);
  });

  it('assertOperationalModel rejects empty and phantom ids', () => {
    expect(() => assertOperationalModel('openai', '', 'SCRIBE')).toThrow(
      /\[SCRIBE\] modèle non opérationnel/,
    );
    expect(() => assertOperationalModel('openai', 'unknown-model', 'SCRIBE')).toThrow();
    expect(() => assertOperationalModel('openai', 'gpt-5.5-2026-04-23')).not.toThrow();
  });

  it('enforces blocking capabilities only when a real capability profile exists', () => {
    expect(modelSupportsAgent('text-only-unknown', 'SCRIBE')).toBe(false);
    expect(missingAgentCapabilities('text-only-unknown', 'SCRIBE')).toEqual(
      expect.arrayContaining(['vision', 'structured']),
    );
    expect(modelSupportsAgent('text-only-unknown', 'EDITOR')).toBe(true);
    expect(modelSupportsAgent('gemini-3.5-flash', 'SCRIBE')).toBe(true);
  });

  it('accepts valid Desk saves for all providers', () => {
    expect(() =>
      assertSavableAgentModel('SCRIBE', 'openai', 'gpt-4o-2024-11-20'),
    ).not.toThrow();
    expect(() =>
      assertSavableAgentModel('SCRIBE', 'vertex', 'gemini-3.5-flash'),
    ).not.toThrow();
    expect(() =>
      assertSavableAgentModel('GUIDE', 'gemini', 'gemini-3.5-flash'),
    ).not.toThrow();
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
