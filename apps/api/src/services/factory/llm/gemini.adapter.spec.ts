import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAdapter } from './gemini.adapter';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(),
  SchemaType: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
  },
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

  it('completes a text request and returns usage tokens', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => '  hello  ',
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
      },
    });
    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent }),
    }));

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
});
