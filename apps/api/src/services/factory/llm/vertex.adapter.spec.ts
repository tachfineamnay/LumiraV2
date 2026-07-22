import { sanitizeGoogleJsonSchema } from './google-schema';
import { VertexAdapter } from './vertex.adapter';

describe('VertexAdapter', () => {
  it('throws when credentials are missing', async () => {
    const adapter = new VertexAdapter(async () => null);
    await expect(
      adapter.complete({
        model: 'gemini-2.5-flash',
        systemPrompt: 'sys',
        userContent: 'ping',
        maxTokens: 8,
        signal: new AbortController().signal,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/vertex_not_configured/);
  });

  it('sanitizes additionalProperties from JSON schemas', () => {
    const cleaned = sanitizeGoogleJsonSchema({
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean', additionalProperties: false },
      },
    });
    expect(cleaned).toEqual({
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
      },
    });
  });
});
