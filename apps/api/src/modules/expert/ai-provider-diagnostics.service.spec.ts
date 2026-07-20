import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({ generateContent: mockGenerateContent }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));

const mockChatCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    chat: { completions: { create: mockChatCreate } },
  })),
}));

describe('AiProviderDiagnosticsService', () => {
  let service: AiProviderDiagnosticsService;
  let configGet: jest.Mock;
  let prisma: { promptVersion: { findFirst: jest.Mock } };

  const modelConfigJson = JSON.stringify({
    heavyModel: 'gemini-2.5-flash',
    flashModel: 'gemini-2.5-flash',
    openaiFlashModel: 'gpt-4o-mini',
    openaiHeavyModel: 'gpt-4o',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    configGet = jest.fn();
    prisma = {
      promptVersion: {
        findFirst: jest.fn().mockResolvedValue({
          value: modelConfigJson,
        }),
      },
    };

    service = new AiProviderDiagnosticsService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    service.clearCacheForTests();

    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'pong' },
    });
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'pong' } }],
    });
  });

  it('reports gemini as not configured when GEMINI_API_KEY is absent', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'GEMINI_API_KEY') return undefined;
      return undefined;
    });

    const status = await service.getCredentialsStatus();
    expect(status.gemini.configured).toBe(false);
    expect(status.gemini.state).toBe('not_configured');

    const result = await service.testGeminiConnection({ force: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain('GEMINI_API_KEY');
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it('tests gemini with the configured model on success', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
      return undefined;
    });

    const result = await service.testGeminiConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.text).toBe('ok');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.5-flash' });
    expect(JSON.stringify(result)).not.toContain('test-gemini-key');
  });

  it('tests openai with the configured flash model', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'sk-test-openai-key-1234567890';
      return undefined;
    });

    const result = await service.testOpenAIConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.model).toBe('gpt-4o-mini');
    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini', max_tokens: 8 }),
    );
    expect(JSON.stringify(result)).not.toContain('sk-test-openai-key');
  });

  it('does not pretend openai is configured without OPENAI_API_KEY', async () => {
    configGet.mockReturnValue(undefined);

    const status = await service.getCredentialsStatus();
    expect(status.openai.configured).toBe(false);

    const result = await service.testOpenAIConnection({ force: true });
    expect(result.success).toBe(false);
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it('maps gemini 401 errors clearly', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'bad-key' : undefined,
    );
    mockGenerateContent.mockRejectedValue(new Error('401 Unauthorized API_KEY_INVALID'));

    const result = await service.testGeminiConnection({ force: true });
    expect(result.success).toBe(false);
    expect(result.errorCategory).toBe('invalid_key');
    expect(result.error).toContain('401');
  });

  it('maps openai 403 errors clearly', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );
    mockChatCreate.mockRejectedValue(new Error('403 Permission denied forbidden'));

    const result = await service.testOpenAIConnection({ force: true });
    expect(result.errorCategory).toBe('forbidden');
  });

  it('maps 429 rate limit errors', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );
    mockChatCreate.mockRejectedValue(new Error('429 Too Many Requests rate limit exceeded'));

    const result = await service.testOpenAIConnection({ force: true });
    expect(result.errorCategory).toBe('rate_limit');
  });

  it('maps invalid model errors', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test' : undefined,
    );
    mockChatCreate.mockRejectedValue(new Error('404 The model `gpt-unknown` does not exist'));

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
          /* never resolves */
        }),
    );

    const result = await service.testGeminiConnection({ force: true, timeoutMs: 5 });
    expect(result.errorCategory).toBe('timeout');
  });

  it('health snapshot uses cache without calling providers', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
      return undefined;
    });

    await service.testGeminiConnection({ force: true });
    mockGenerateContent.mockClear();

    const health = await service.getAiHealthSnapshotWithModels();
    expect(health.gemini.text).toBe('ok');
    expect(health.gemini.configured).toBe(true);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns not_tested on health before any voluntary test', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
      return undefined;
    });

    const health = await service.getAiHealthSnapshotWithModels();
    expect(health.gemini.text).toBe('not_tested');
    expect(health.gemini.multimodal).toBe('not_tested');
    expect(health.gemini.model).toBe('gemini-2.5-flash');
  });
});
