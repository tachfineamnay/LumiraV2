import {
  getModelRuntimeControls,
  isOperationalThinkingModel,
  supportsThinkingLevel,
} from './model-runtime-controls';

describe('model-runtime-controls', () => {
  describe('OpenAI models', () => {
    it('gpt-5.4 supports low, medium, high, xhigh and defaults to medium (none is removed)', () => {
      const controls = getModelRuntimeControls('openai', 'gpt-5.4-2026-03-05');
      expect(controls.thinkingLevels).toEqual(['low', 'medium', 'high', 'xhigh']);
      expect(controls.defaultThinkingLevel).toBe('medium');
      expect(controls.maxOutputTokens).toBe(128000);
      expect(controls.capabilities).toEqual(['text', 'vision', 'structured', 'long_text']);
      expect(controls.operational).toBe(true);
      expect(controls.operationalReason).toBe('thinking_supported');
      expect(controls.thinkingLevels.includes('none' as any)).toBe(false);
      expect(controls.thinkingLevels.includes('minimal' as any)).toBe(false);
    });

    it('gpt-5.5 supports low, medium, high, xhigh and defaults to medium', () => {
      const controls = getModelRuntimeControls('openai', 'gpt-5.5-2026-04-23');
      expect(controls.thinkingLevels).toEqual(['low', 'medium', 'high', 'xhigh']);
      expect(controls.defaultThinkingLevel).toBe('medium');
      expect(controls.maxOutputTokens).toBe(128000);
      expect(controls.capabilities).toEqual(['text', 'vision', 'structured', 'long_text']);
      expect(controls.operational).toBe(true);
    });

    it('preview variant gpt-5.4-preview retains vision and structured capabilities', () => {
      const controls = getModelRuntimeControls('openai', 'gpt-5.4-preview');
      expect(controls.operational).toBe(true);
      expect(controls.maxOutputTokens).toBe(128000);
      expect(controls.capabilities).toContain('vision');
      expect(controls.capabilities).toContain('structured');
    });

    it('gpt-4o, gpt-4.1, gpt-3.5 are legacy non-operational models', () => {
      for (const model of ['gpt-4o-2024-11-20', 'gpt-4.1-turbo', 'gpt-3.5-turbo']) {
        const controls = getModelRuntimeControls('openai', model);
        expect(controls.thinkingLevels).toEqual([]);
        expect(controls.defaultThinkingLevel).toBeUndefined();
        expect(controls.maxOutputTokens).toBe(0);
        expect(controls.capabilities).toEqual([]);
        expect(controls.operational).toBe(false);
        expect(controls.operationalReason).toBe('legacy_model');
        expect(isOperationalThinkingModel('openai', model)).toBe(false);
        expect(supportsThinkingLevel('openai', model)).toBe(false);
      }
    });
  });

  describe('Gemini and Vertex models', () => {
    it('gemini-3.6-flash supports minimal, low, medium, high and defaults to medium', () => {
      const controls = getModelRuntimeControls('gemini', 'gemini-3.6-flash');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('medium');
      expect(controls.maxOutputTokens).toBe(65536);
      expect(controls.capabilities).toEqual([
        'text',
        'vision',
        'structured',
        'long_text',
        'fast_text',
      ]);
      expect(controls.operational).toBe(true);
      expect(controls.thinkingLevels.includes('none' as any)).toBe(false);
      expect(controls.thinkingLevels.includes('xhigh' as any)).toBe(false);
    });

    it('preview variant gemini-3.6-flash-preview retains vision and structured capabilities', () => {
      const controls = getModelRuntimeControls('gemini', 'gemini-3.6-flash-preview');
      expect(controls.operational).toBe(true);
      expect(controls.maxOutputTokens).toBe(65536);
      expect(controls.capabilities).toContain('vision');
      expect(controls.capabilities).toContain('structured');
    });

    it('gemini-3.5-flash supports minimal, low, medium, high and defaults to medium', () => {
      const controls = getModelRuntimeControls('vertex', 'gemini-3.5-flash');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('medium');
      expect(controls.maxOutputTokens).toBe(65536);
      expect(controls.operational).toBe(true);
    });

    it('gemini-3.5-flash-lite supports minimal, low, medium, high and defaults to minimal', () => {
      const controls = getModelRuntimeControls('gemini', 'gemini-3.5-flash-lite');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('minimal');
      expect(controls.maxOutputTokens).toBe(65536);
      expect(controls.operational).toBe(true);
    });

    it('gemini-3.1-pro-preview supports low, medium, high and defaults to high (minimal and xhigh are unsupported)', () => {
      const controls = getModelRuntimeControls('vertex', 'gemini-3.1-pro-preview');
      expect(controls.thinkingLevels).toEqual(['low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('high');
      expect(controls.maxOutputTokens).toBe(65536);
      expect(controls.capabilities).toEqual(['text', 'vision', 'structured', 'long_text']);
      expect(controls.operational).toBe(true);
      expect(controls.thinkingLevels.includes('minimal' as any)).toBe(false);
      expect(controls.thinkingLevels.includes('xhigh' as any)).toBe(false);
    });

    it('gemini-3.1-pro without -preview is non-operational', () => {
      const controls = getModelRuntimeControls('vertex', 'gemini-3.1-pro');
      expect(controls.operational).toBe(false);
      expect(isOperationalThinkingModel('vertex', 'gemini-3.1-pro')).toBe(false);
    });

    it('gemini-3-flash supports minimal, low, medium, high and defaults to high', () => {
      const controls = getModelRuntimeControls('gemini', 'gemini-3-flash');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('high');
      expect(controls.maxOutputTokens).toBe(65536);
      expect(controls.operational).toBe(true);
    });

    it('gemini-3-pro supports low and high and defaults to high', () => {
      const controls = getModelRuntimeControls('vertex', 'gemini-3-pro');
      expect(controls.thinkingLevels).toEqual(['low', 'high']);
      expect(controls.defaultThinkingLevel).toBe('high');
      expect(controls.maxOutputTokens).toBe(65536);
      expect(controls.operational).toBe(true);
    });

    it('gemini-2.5 models are legacy non-operational models', () => {
      for (const model of ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']) {
        const controls = getModelRuntimeControls('gemini', model);
        expect(controls.thinkingLevels).toEqual([]);
        expect(controls.maxOutputTokens).toBe(0);
        expect(controls.operational).toBe(false);
        expect(controls.operationalReason).toBe('legacy_model');
        expect(isOperationalThinkingModel('gemini', model)).toBe(false);
      }
    });
  });

  describe('Unknown models & Non-text models (fail-closed)', () => {
    it('returns empty thinkingLevels and operationalReason=thinking_not_registered for unknown models', () => {
      const controls = getModelRuntimeControls('openai', 'some-unknown-model');
      expect(controls.thinkingLevels).toEqual([]);
      expect(controls.defaultThinkingLevel).toBeUndefined();
      expect(controls.maxOutputTokens).toBe(0);
      expect(controls.operational).toBe(false);
      expect(controls.operationalReason).toBe('thinking_not_registered');
      expect(isOperationalThinkingModel('openai', 'some-unknown-model')).toBe(false);
    });

    it('returns operationalReason=non_text_model for audio, tts, image or embedding models', () => {
      for (const model of [
        'dall-e-3',
        'whisper-1',
        'text-embedding-3-large',
        'gemini-2.5-flash-tts',
      ]) {
        const controls = getModelRuntimeControls('openai', model);
        expect(controls.operational).toBe(false);
        expect(controls.operationalReason).toBe('non_text_model');
      }
    });
  });
});
