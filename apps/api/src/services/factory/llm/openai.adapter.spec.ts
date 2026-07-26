import OpenAI from 'openai';
import { OpenAiAdapter } from './openai.adapter';
import { LlmRequest } from './llm.types';

describe('OpenAiAdapter (thinking-only production policy)', () => {
  let adapter: OpenAiAdapter;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    mockCreate = jest.fn().mockResolvedValue({
      status: 'completed',
      output_text: 'Test response',
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    const fakeClient = {
      responses: {
        create: mockCreate,
      },
    } as unknown as OpenAI;
    adapter = new OpenAiAdapter(fakeClient);
  });

  function makeRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
    return {
      model: 'gpt-5.4-2026-03-05',
      systemPrompt: 'sys prompt',
      userContent: 'user content',
      maxTokens: 1000,
      signal: new AbortController().signal,
      timeoutMs: 5000,
      ...overrides,
    };
  }

  it('sends reasoning.effort and max_output_tokens for gpt-5.4 with thinkingLevel=medium', async () => {
    await adapter.complete(makeRequest({ thinkingLevel: 'medium' }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const params = mockCreate.mock.calls[0][0];
    expect(params.reasoning).toEqual({ effort: 'medium' });
    expect(params.max_output_tokens).toBe(1000);
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
    expect(params.text?.verbosity).toBeUndefined();
  });

  it('throws an error for non-operational gpt-4o without making API call', async () => {
    await expect(
      adapter.complete(makeRequest({ model: 'gpt-4o-2024-11-20', thinkingLevel: 'high' as any })),
    ).rejects.toThrow(/n'est pas autorisé pour la production Lumira/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('throws an error when thinkingLevel is missing for operational model', async () => {
    await expect(
      adapter.complete(makeRequest({ model: 'gpt-5.5-2026-04-23', thinkingLevel: undefined })),
    ).rejects.toThrow(/un niveau de réflexion valide est obligatoire/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('never includes temperature, top_p, or text.verbosity in any OpenAI payload', async () => {
    await adapter.complete(makeRequest({ model: 'gpt-5.5-2026-04-23', thinkingLevel: 'xhigh' }));
    const params = mockCreate.mock.calls[0][0];
    expect(params.reasoning).toEqual({ effort: 'xhigh' });
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
    expect(params.text?.verbosity).toBeUndefined();
  });

  it('places an explicit role immediately before every vision input', async () => {
    await adapter.complete(
      makeRequest({
        thinkingLevel: 'medium',
        images: [{ mimeType: 'image/jpeg', base64: 'ZmFjZQ==', role: 'FACE_FRONT' }],
      }),
    );
    expect(mockCreate.mock.calls[0][0].input[0].content).toEqual([
      { type: 'input_text', text: 'user content' },
      { type: 'input_text', text: 'Image suivante — rôle vérifié: FACE_FRONT.' },
      expect.objectContaining({
        type: 'input_image',
        image_url: expect.stringContaining('ZmFjZQ=='),
      }),
    ]);
  });
});
