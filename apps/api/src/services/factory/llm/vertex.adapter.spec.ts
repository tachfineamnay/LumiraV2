import { GoogleGenAI } from '@google/genai';
import { sanitizeGoogleJsonSchema } from './google-schema';
import { VertexAdapter } from './vertex.adapter';
import { resolveVertexLocation, DEFAULT_VERTEX_LOCATION } from './vertex-location';
import { classifyNormalizedAiError, isRetryableNormalizedError } from './ai-errors';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

const SERVICE_ACCOUNT = JSON.stringify({
  type: 'service_account',
  project_id: 'demo-project',
  client_email: 'demo@demo.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n',
});

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

  it('uses VERTEX_LOCATION and service account auth, never GEMINI_API_KEY', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      text: 'pong',
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });
    (GoogleGenAI as unknown as jest.Mock).mockImplementation((options: Record<string, unknown>) => {
      expect(options.vertexai).toBe(true);
      expect(options.project).toBe('demo-project');
      expect(options.location).toBe('europe-west1');
      expect(options.apiKey).toBeUndefined();
      expect(options.googleAuthOptions).toBeTruthy();
      return { models: { generateContent } };
    });

    const adapter = new VertexAdapter(async () => SERVICE_ACCOUNT, 'europe-west1');
    expect(adapter.getLocation()).toBe('europe-west1');
    const result = await adapter.complete({
      model: 'gemini-2.5-pro',
      systemPrompt: 'sys',
      userContent: 'ping',
      maxTokens: 8,
      signal: new AbortController().signal,
      timeoutMs: 5000,
    });
    expect(result.text).toBe('pong');
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

describe('vertex-location', () => {
  it('uses the same default everywhere when env is empty', () => {
    const previous = process.env.VERTEX_LOCATION;
    delete process.env.VERTEX_LOCATION;
    expect(resolveVertexLocation()).toBe(DEFAULT_VERTEX_LOCATION);
    expect(resolveVertexLocation({ get: () => undefined })).toBe(DEFAULT_VERTEX_LOCATION);
    process.env.VERTEX_LOCATION = previous;
  });
});

describe('ai-errors retry policy', () => {
  it('does not retry quota_billing', () => {
    expect(classifyNormalizedAiError('insufficient_quota billing')).toBe('quota_billing');
    expect(isRetryableNormalizedError('quota_billing')).toBe(false);
  });

  it('retries rate_limit and network', () => {
    expect(isRetryableNormalizedError('rate_limit')).toBe(true);
    expect(isRetryableNormalizedError('network')).toBe(true);
  });
});
