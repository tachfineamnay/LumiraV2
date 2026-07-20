import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_AI_MODEL_CONFIG } from '../../services/factory/ai-model-config';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));
const mockResponsesCreate = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    responses: { create: mockResponsesCreate },
  })),
}));

describe('AiProviderDiagnosticsService', () => {
  let service: AiProviderDiagnosticsService;
  let configGet: jest.Mock;
  let prisma: { promptVersion: { findFirst: jest.Mock } };

  const modelConfigJson = JSON.stringify(DEFAULT_AI_MODEL_CONFIG);

  beforeEach(() => {
    jest.clearAllMocks();
    configGet = jest.fn();
    prisma = {
      promptVersion: {
        findFirst: jest.fn().mockResolvedValue({ value: modelConfigJson }),
      },
    };

    service = new AiProviderDiagnosticsService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    service.clearCacheForTests();

    mockGenerateContent.mockResolvedValue({ response: { text: () => 'pong' } });
    mockResponsesCreate.mockResolvedValue({ output_text: JSON.stringify({ ok: true }) });
  });

  it('reports gemini as not configured when GEMINI_API_KEY is absent', async () => {
    configGet.mockReturnValue(undefined);

    const status = await service.getCredentialsStatus();
    expect(status.gemini.configured).toBe(false);
    expect(status.gemini.state).toBe('not_configured');

    const result = await service.testGeminiConnection({ force: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain('GEMINI_API_KEY');
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it('tests gemini text and multimodal with the dormant comparison model', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );

    const result = await service.testGeminiConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.text).toBe('ok');
    expect(result.multimodal).toBe('ok');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain('test-gemini-key');
  });

  it('tests the real OpenAI Responses structured text and vision path', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test-openai-key-1234567890' : undefined,
    );

    const result = await service.testOpenAIConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.model).toBe('gpt-5.5-2026-04-23');
    expect(result.text).toBe('ok');
    expect(result.multimodal).toBe('ok');
    expect(mockResponsesCreate).toHaveBeenCalledTimes(2);
    expect(mockResponsesCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: 'gpt-5.5-2026-04-23',
        reasoning: { effort: 'low' },
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({ type: 'json_schema', strict: true }),
        }),
      }),
    );
    expect(JSON.stringify(mockResponsesCreate.mock.calls[1][0].input)).toContain('input_image');
    expect(JSON.stringify(result)).not.toContain('sk-test-openai-key');
  });

  it('does not pretend OpenAI is configured without OPENAI_API_KEY', async () => {
    configGet.mockReturnValue(undefined);

    const status = await service.getCredentialsStatus();
    expect(status.openai.configured).toBe(false);

    const result = await service.testOpenAIConnection({ force: true });
    expect(result.success).toBe(false);
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it('fails the provider test when vision fails after a successful text probe', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );
    mockResponsesCreate
      .mockResolvedValueOnce({ output_text: JSON.stringify({ ok: true }) })
      .mockRejectedValueOnce(new Error('403 Permission denied forbidden'));

    const result = await service.testOpenAIConnection({ force: true });

    expect(result.success).toBe(false);
    expect(result.text).toBe('ok');
    expect(result.multimodal).toBe('error');
    expect(result.errorCategory).toBe('forbidden');
  });

  it('maps OpenAI 429 errors clearly', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );
    mockResponsesCreate.mockRejectedValue(new Error('429 Too Many Requests rate limit exceeded'));

    const result = await service.testOpenAIConnection({ force: true });
    expect(result.errorCategory).toBe('rate_limit');
    expect(result.multimodal).toBe('not_tested');
  });

  it('maps invalid snapshot errors', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );
    mockResponsesCreate.mockRejectedValue(new Error('404 The model does not exist'));

    const result = await service.testOpenAIConnection({ force: true });
    expect(result.errorCategory).toBe('model_not_found');
    expect(result.error).toContain('Modèle inaccessible');
  });

  it('maps timeout errors', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
    );
    mockGenerateContent.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves.
        }),
    );

    const result = await service.testGeminiConnection({ force: true, timeoutMs: 5 });
    expect(result.errorCategory).toBe('timeout');
  });

  it('health snapshot uses cache without calling providers', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );

    await service.testOpenAIConnection({ force: true });
    mockResponsesCreate.mockClear();

    const health = await service.getAiHealthSnapshotWithModels();
    expect(health.openai.text).toBe('ok');
    expect(health.openai.multimodal).toBe('ok');
    expect(health.openai.configured).toBe(true);
    expect(health.openai.model).toBe('gpt-5.5-2026-04-23');
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it('returns not_tested before any voluntary test', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );

    const health = await service.getAiHealthSnapshotWithModels();
    expect(health.openai.text).toBe('not_tested');
    expect(health.openai.multimodal).toBe('not_tested');
    expect(health.openai.model).toBe('gpt-5.5-2026-04-23');
  });
});
