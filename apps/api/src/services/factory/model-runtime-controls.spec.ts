import { getModelRuntimeControls, supportsThinkingLevel } from './model-runtime-controls';

describe('model-runtime-controls', () => {
  describe('OpenAI models', () => {
    it('gpt-5.4 supports none, low, medium, high, xhigh and defaults to none', () => {
      const controls = getModelRuntimeControls('openai', 'gpt-5.4-2026-03-05');
      expect(controls.thinkingLevels).toEqual(['none', 'low', 'medium', 'high', 'xhigh']);
      expect(controls.defaultThinkingLevel).toBe('none');
      expect(controls.supportsVerbosity).toBe(true);
      expect(controls.thinkingLevels.includes('minimal' as any)).toBe(false);
    });

    it('gpt-5.5 supports none, low, medium, high, xhigh and defaults to medium', () => {
      const controls = getModelRuntimeControls('openai', 'gpt-5.5-2026-04-23');
      expect(controls.thinkingLevels).toEqual(['none', 'low', 'medium', 'high', 'xhigh']);
      expect(controls.defaultThinkingLevel).toBe('medium');
      expect(controls.supportsVerbosity).toBe(true);
    });

    it('gpt-4o returns empty controls', () => {
      const controls = getModelRuntimeControls('openai', 'gpt-4o-2024-11-20');
      expect(controls.thinkingLevels).toEqual([]);
      expect(controls.defaultThinkingLevel).toBeUndefined();
      expect(controls.supportsVerbosity).toBe(false);
      expect(supportsThinkingLevel('openai', 'gpt-4o-2024-11-20')).toBe(false);
    });
  });

  describe('Gemini and Vertex models', () => {
    it('gemini-3.6-flash supports minimal, low, medium, high and defaults to medium', () => {
      const controls = getModelRuntimeControls('gemini', 'gemini-3.6-flash');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('medium');
      expect(controls.thinkingLevels.includes('none' as any)).toBe(false);
      expect(controls.thinkingLevels.includes('xhigh' as any)).toBe(false);
    });

    it('gemini-3.5-flash supports minimal, low, medium, high and defaults to medium', () => {
      const controls = getModelRuntimeControls('vertex', 'gemini-3.5-flash');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('medium');
    });

    it('gemini-3.5-flash-lite supports minimal, low, medium, high and defaults to minimal', () => {
      const controls = getModelRuntimeControls('gemini', 'gemini-3.5-flash-lite');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('minimal');
    });

    it('gemini-3.1-pro supports low, medium, high and defaults to high (minimal is unsupported)', () => {
      const controls = getModelRuntimeControls('vertex', 'gemini-3.1-pro-preview');
      expect(controls.thinkingLevels).toEqual(['low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('high');
      expect(controls.thinkingLevels.includes('minimal' as any)).toBe(false);
    });

    it('gemini-3-flash supports minimal, low, medium, high and defaults to high', () => {
      const controls = getModelRuntimeControls('gemini', 'gemini-3-flash');
      expect(controls.thinkingLevels).toEqual(['minimal', 'low', 'medium', 'high']);
      expect(controls.defaultThinkingLevel).toBe('high');
    });

    it('gemini-3-pro supports low and high and defaults to high', () => {
      const controls = getModelRuntimeControls('vertex', 'gemini-3-pro');
      expect(controls.thinkingLevels).toEqual(['low', 'high']);
      expect(controls.defaultThinkingLevel).toBe('high');
    });

    it('gemini-2.5 models return empty controls', () => {
      expect(getModelRuntimeControls('gemini', 'gemini-2.5-flash').thinkingLevels).toEqual([]);
      expect(getModelRuntimeControls('vertex', 'gemini-2.5-pro').thinkingLevels).toEqual([]);
    });
  });

  describe('Unknown models (fail-closed)', () => {
    it('returns empty thinkingLevels and no speculative controls', () => {
      const controls = getModelRuntimeControls('openai', 'some-unknown-model');
      expect(controls.thinkingLevels).toEqual([]);
      expect(controls.defaultThinkingLevel).toBeUndefined();
      expect(supportsThinkingLevel('openai', 'some-unknown-model')).toBe(false);
    });
  });
});
