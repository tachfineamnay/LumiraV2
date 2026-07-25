import OpenAI from 'openai';
import { OpenAiAdapter } from './openai.adapter';
import { LlmRequest } from './llm.types';

describe('OpenAiAdapter', () => {
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

  it('sends reasoning effort and max_output_tokens for gpt-5.4 with thinkingLevel=medium', async () => {
    await adapter.complete(makeRequest({ thinkingLevel: 'medium' }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const params = mockCreate.mock.calls[0][0];
    expect(params.reasoning).toEqual({ effort: 'medium' });
    expect(params.max_output_tokens).toBe(1000);
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
  });

  it('sends reasoning effort none for gpt-5.4 with thinkingLevel=none', async () => {
    await adapter.complete(makeRequest({ thinkingLevel: 'none' }));
    const params = mockCreate.mock.calls[0][0];
    expect(params.reasoning).toEqual({ effort: 'none' });
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
  });

  it('does NOT send reasoning, temperature or top_p for gpt-4o', async () => {
    await adapter.complete(makeRequest({ model: 'gpt-4o-2024-11-20', thinkingLevel: 'high' }));
    const params = mockCreate.mock.calls[0][0];
    expect(params.reasoning).toBeUndefined();
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
    expect(params.max_output_tokens).toBe(1000);
  });

  it('never includes temperature or top_p in any OpenAI call payload', async () => {
    await adapter.complete(makeRequest({ model: 'gpt-5.5-2026-04-23', thinkingLevel: 'xhigh' }));
    const params = mockCreate.mock.calls[0][0];
    expect(params.reasoning).toEqual({ effort: 'xhigh' });
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
  });
});
