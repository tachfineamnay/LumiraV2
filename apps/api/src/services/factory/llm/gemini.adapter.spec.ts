import { GoogleGenAI } from '@google/genai';
import { GeminiAdapter } from './gemini.adapter';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

describe('GeminiAdapter', () => {
  it('throws when API key is missing', async () => {
    const adapter = new GeminiAdapter(() => undefined);
    await expect(
      adapter.complete({
        model: 'gemini-2.5-flash',
        systemPrompt: 'sys',
        userContent: 'ping',
        maxTokens: 8,
        signal: new AbortController().signal,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/gemini_not_configured/);
  });

  it('completes a text request and returns usage tokens via Gemini Developer API', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      text: '  hello  ',
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
    });
    (GoogleGenAI as unknown as jest.Mock).mockImplementation(
      (options: { apiKey?: string; vertexai?: boolean }) => {
        expect(options.apiKey).toBe('test-key');
        expect(options.vertexai).toBe(false);
        return { models: { generateContent } };
      },
    );

    const adapter = new GeminiAdapter(() => 'test-key');
    const result = await adapter.complete({
      model: 'gemini-2.5-flash',
      systemPrompt: 'sys',
      userContent: 'ping',
      maxTokens: 8,
      signal: new AbortController().signal,
      timeoutMs: 5000,
    });

    expect(result.text).toBe('hello');
    expect(result.inputTokens).toBe(3);
    expect(result.outputTokens).toBe(2);
    expect(generateContent).toHaveBeenCalled();
  });

  it('never passes Vertex credentials', async () => {
    const generateContent = jest.fn().mockResolvedValue({ text: 'ok' });
    (GoogleGenAI as unknown as jest.Mock).mockImplementation((options: Record<string, unknown>) => {
      expect(options.vertexai).toBe(false);
      expect(options.project).toBeUndefined();
      expect(options.googleAuthOptions).toBeUndefined();
      return { models: { generateContent } };
    });

    const adapter = new GeminiAdapter(() => 'test-key');
    await adapter.complete({
      model: 'gemini-2.5-flash',
      systemPrompt: 'sys',
      userContent: 'ping',
      maxTokens: 8,
      signal: new AbortController().signal,
      timeoutMs: 5000,
    });
  });
});
