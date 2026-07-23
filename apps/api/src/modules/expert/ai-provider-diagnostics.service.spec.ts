import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_AI_MODEL_CONFIG } from '../../services/factory/ai-model-config';

const mockGenerateContent = jest.fn();
const mockResponsesCreate = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
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
  let prisma: {
    promptVersion: { findFirst: jest.Mock };
    systemSetting: { findUnique: jest.Mock };
  };

  const modelConfigJson = JSON.stringify(DEFAULT_AI_MODEL_CONFIG);

  beforeEach(() => {
    jest.clearAllMocks();
    configGet = jest.fn();
    prisma = {
      promptVersion: {
        findFirst: jest.fn().mockResolvedValue({ value: modelConfigJson }),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    service = new AiProviderDiagnosticsService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    service.clearCacheForTests();

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ ok: true }),
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });
    (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
      models: { generateContent: mockGenerateContent },
    }));
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
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  it('tests gemini text, multimodal and structured via Developer API', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );

    const result = await service.testGeminiConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.text).toBe('ok');
    expect(result.multimodal).toBe('ok');
    expect(result.structured).toBe('ok');
    expect(result.models?.[0]?.structured).toBe('ok');
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('test-gemini-key');
    expect(GoogleGenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-gemini-key',
        vertexai: false,
        apiVersion: 'v1',
      }),
    );
  });

  it('fails when structured probe errors even if text and vision succeed', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );

    let call = 0;
    mockGenerateContent.mockImplementation(async () => {
      call += 1;
      if (call === 3) {
        throw new Error('response_schema is not supported for this model');
      }
      return {
        text: JSON.stringify({ ok: true }),
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      };
    });

    const result = await service.testGeminiConnection({ force: true });
    expect(result.success).toBe(false);
    expect(result.text).toBe('ok');
    expect(result.multimodal).toBe('ok');
    expect(result.structured).toBe('error');
    expect(result.errorCategory).toBe('structured_output_unsupported');
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
    expect(result.structured).toBe('ok');
    expect(result.models).toHaveLength(3);
    expect(result.models.map((entry) => entry.model)).toEqual([
      'gpt-5.5-2026-04-23',
      'gpt-5.4-2026-03-05',
      'gpt-4o-2024-11-20',
    ]);
    // SCRIBE needs vision (text+vision); other active models are text/structured only.
    expect(mockResponsesCreate).toHaveBeenCalledTimes(4);
    expect(mockResponsesCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: 'gpt-5.5-2026-04-23',
        reasoning: { effort: 'low' },
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({ type: 'json_schema' }),
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('sk-test-openai-key');
  });

  it('does not call OpenAI when the key is missing', async () => {
    configGet.mockReturnValue(undefined);
    const result = await service.testOpenAIConnection({ force: true });
    expect(result.success).toBe(false);
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it('tests two active Vertex models separately and keeps caches isolated', async () => {
    const vertexConfig = {
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.SCRIBE,
          provider: 'vertex',
          model: 'gemini-2.5-pro',
          temperature: 0.7,
          topP: 0.9,
        },
        GUIDE: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.GUIDE,
          provider: 'vertex',
          model: 'gemini-2.5-flash',
          temperature: 0.5,
          topP: 0.9,
        },
        EDITOR: { ...DEFAULT_AI_MODEL_CONFIG.agents.EDITOR, enabled: false },
        NARRATOR: { ...DEFAULT_AI_MODEL_CONFIG.agents.NARRATOR, enabled: false },
        CONFIDANT: { ...DEFAULT_AI_MODEL_CONFIG.agents.CONFIDANT, enabled: false },
        ONIRIQUE: { ...DEFAULT_AI_MODEL_CONFIG.agents.ONIRIQUE, enabled: false },
      },
    };
    prisma.promptVersion.findFirst.mockResolvedValue({
      value: JSON.stringify(vertexConfig),
    });
    prisma.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        type: 'service_account',
        project_id: 'demo',
        client_email: 'a@b.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n',
      }),
    });
    configGet.mockImplementation((key: string) => {
      if (key === 'VERTEX_LOCATION') return 'us-central1';
      return undefined;
    });

    const result = await service.testVertexConnection({ force: true });
    expect(result.models).toHaveLength(2);
    expect(result.models.map((m) => m.model).sort()).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ]);
    expect(result.success).toBe(true);
    expect(result.structured).toBeDefined();

    // Cache keyed by provider:model — flash success must not imply a fresh untested model.
    const cachedPro = service.getModelProbe('vertex', 'gemini-2.5-pro');
    const cachedFlash = service.getModelProbe('vertex', 'gemini-2.5-flash');
    expect(cachedPro?.text).toBe('ok');
    expect(cachedFlash?.text).toBe('ok');
    expect(cachedPro?.model).toBe('gemini-2.5-pro');
    expect(cachedFlash?.model).toBe('gemini-2.5-flash');

    service.clearProviderCache('vertex');
    expect(service.getModelProbe('vertex', 'gemini-2.5-pro')).toBeNull();
    expect(service.getModelProbe('vertex', 'gemini-2.5-flash')).toBeNull();
  });

  it('force=true ignores cache and re-runs probes', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );

    await service.testGeminiConnection({ force: true });
    const firstCalls = mockGenerateContent.mock.calls.length;
    await service.testGeminiConnection({ force: false });
    expect(mockGenerateContent.mock.calls.length).toBe(firstCalls);
    await service.testGeminiConnection({ force: true });
    expect(mockGenerateContent.mock.calls.length).toBeGreaterThan(firstCalls);
  });
});
