import {
  classifyAiError,
  sanitizeAiErrorMessage,
  withTimeout,
} from './ai-provider-diagnostics.utils';

describe('ai-provider-diagnostics.utils', () => {
  describe('sanitizeAiErrorMessage', () => {
    it('redacts Gemini and OpenAI key patterns', () => {
      const message =
        'Invalid key AIzaSyD_example_key_12345 and sk-proj-abcdefghijklmnopqrstuvwxyz';
      const sanitized = sanitizeAiErrorMessage(message);
      expect(sanitized).not.toContain('AIzaSyD_example_key_12345');
      expect(sanitized).not.toContain('sk-proj-abcdefghijklmnopqrstuvwxyz');
      expect(sanitized).toContain('[redacted]');
    });
  });

  describe('classifyAiError', () => {
    it('maps 401 to invalid_key', () => {
      expect(classifyAiError('401 Unauthorized').category).toBe('invalid_key');
    });

    it('maps 403 to forbidden', () => {
      expect(classifyAiError('403 Permission denied').category).toBe('forbidden');
    });

    it('maps 429 to rate_limit', () => {
      expect(classifyAiError('429 Too Many Requests rate limit').category).toBe('rate_limit');
    });

    it('maps quota errors', () => {
      expect(classifyAiError('RESOURCE_EXHAUSTED quota exceeded billing').category).toBe('quota');
    });

    it('includes provider and model in user messages when provided', () => {
      const result = classifyAiError('404 model does not exist', {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
      });
      expect(result.category).toBe('model_not_found');
      expect(result.userMessage).toMatch(/Gemini API/);
      expect(result.userMessage).toMatch(/gemini-2.5-flash/);
    });

    it('maps timeout errors', () => {
      expect(classifyAiError('Gemini text probe timeout after 20000ms').category).toBe('timeout');
    });

    it('maps model not found', () => {
      expect(classifyAiError('404 model gpt-foo does not exist').category).toBe('model_not_found');
    });
  });

  describe('withTimeout', () => {
    it('rejects when the promise exceeds the timeout', async () => {
      await expect(
        withTimeout(new Promise((resolve) => setTimeout(resolve, 50)), 5, 'slow probe'),
      ).rejects.toThrow('slow probe timeout');
    });
  });
});
