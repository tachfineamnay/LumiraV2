import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_AI_MODEL_CONFIG } from '../../services/factory/ai-model-config';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';

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

type Provider = 'openai' | 'gemini' | 'vertex';

function configFor(provider: Provider, model: string, options?: { vision?: boolean; structured?: boolean }) {
  const agents = Object.fromEntries(
    Object.entries(DEFAULT_AI_MODEL_CONFIG.agents).map(([agent, value]) => [
      agent,
      { ...value, enabled: false },
    ]),
  ) as typeof DEFAULT_AI_MODEL_CONFIG.agents;

  agents.SCRIBE = {
    ...agents.SCRIBE,
    enabled: true,
    provider,
    model,
    maxOutputTokens: 24000,
    temperature: provider === 'openai' ? undefined : 0.4,
    topP: provider === 'openai' ? undefined : 0.9,
  };

  if (options?.vision === false || options?.structured === false) {
    agents.SCRIBE.enabled = false;
    agents.EDITOR = {
      ...agents.EDITOR,
      enabled: true,
      provider,
      model,
      maxOutputTokens: 8000,
    };
    if (options?.structured) {
      agents.EDITOR.enabled = false;
      agents.GUIDE = {
        ...agents.GUIDE,
        enabled: true,
        provider,
        model,
        maxOutputTokens: 8000,
      };
    }
  }

  return { providerMode: 'per_agent' as const, agents };
}

function googleResponseFor(request: Record<string, unknown>) {
  const config = (request.config ?? {}) as Record<string, unknown>;
  const contents = request.contents;
  const serialized = JSON.stringify(contents);
  if (config.responseMimeType === 'application/json') {
    return { text: JSON.stringify({ ok: true }) };
  }
  if (serialized.includes('inlineData')) {
    return { text: 'Je vois un cercle rouge, un carré bleu et le nombre 27.' };
  }
  return { text: 'OK' };
}

function openAiResponseFor(request: Record<string, unknown>) {
  if (request.text) return { output_text: JSON.stringify({ ok: true }) };
  if (JSON.stringify(request.input).includes('input_image')) {
    return { output_text: 'Je vois un cercle rouge, un carré bleu et le nombre 27.' };
  }
  return { output_text: 'OK' };
}

describe('AiProviderDiagnosticsService — targeted probes', () => {
  let service: AiProviderDiagnosticsService;
  let configGet: jest.Mock;
  let prisma: {
    promptVersion: { findFirst: jest.Mock };
    systemSetting: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configGet = jest.fn();
    prisma = {
      promptVersion: {
        findFirst: jest.fn().mockResolvedValue({
          value: JSON.stringify(DEFAULT_AI_MODEL_CONFIG),
        }),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    mockGenerateContent.mockImplementation(async (request) => googleResponseFor(request));
    (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
      models: { generateContent: mockGenerateContent },
    }));
    mockResponsesCreate.mockImplementation(async (request) => openAiResponseFor(request));

    service = new AiProviderDiagnosticsService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    service.clearCacheForTests();
  });

  it('does not probe an unused provider, even when its key is absent', async () => {
    const result = await service.testGeminiConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.model).toBe('non utilisé');
    expect(result.models).toEqual([]);
    expect(result.text).toBe('not_tested');
    expect(GoogleGenAI).not.toHaveBeenCalled();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('reports a missing key only when an active agent actually uses Gemini', async () => {
    prisma.promptVersion.findFirst.mockResolvedValue({
      value: JSON.stringify(configFor('gemini', 'gemini-3.5-flash')),
    });

    const result = await service.testGeminiConnection({ force: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain('GEMINI_API_KEY');
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  it('runs exactly text, vision and structured probes for one active Gemini pair', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );
    prisma.promptVersion.findFirst.mockResolvedValue({
      value: JSON.stringify(configFor('gemini', 'gemini-3.5-flash')),
    });

    const result = await service.testGeminiConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.model).toBe('gemini-3.5-flash');
    expect(result.text).toBe('ok');
    expect(result.multimodal).toBe('ok');
    expect(result.structured).toBe('ok');
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(mockGenerateContent.mock.calls.map((call) => call[0].config.maxOutputTokens)).toEqual([
      256,
      256,
      512,
    ]);
    expect(mockGenerateContent.mock.calls[0][0].config).not.toHaveProperty('temperature');
    expect(mockGenerateContent.mock.calls[0][0].config).not.toHaveProperty('topP');
  });

  it('fails the pair when the structured probe fails after text and vision succeed', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );
    prisma.promptVersion.findFirst.mockResolvedValue({
      value: JSON.stringify(configFor('gemini', 'gemini-3.5-flash')),
    });
    mockGenerateContent
      .mockImplementationOnce(async () => ({ text: 'OK' }))
      .mockImplementationOnce(async () => ({
        text: 'Je vois un cercle rouge, un carré bleu et le nombre 27.',
      }))
      .mockRejectedValueOnce(new Error('response_schema is not supported for this model'));

    const result = await service.testGeminiConnection({ force: true });

    expect(result.success).toBe(false);
    expect(result.text).toBe('ok');
    expect(result.multimodal).toBe('ok');
    expect(result.structured).toBe('error');
    expect(result.errorCategory).toBe('structured_output_unsupported');
  });

  it('runs only the selected OpenAI pair through Responses API', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_API_KEY' ? 'sk-test-openai-key-1234567890' : undefined,
    );
    prisma.promptVersion.findFirst.mockResolvedValue({
      value: JSON.stringify(configFor('openai', 'gpt-4o-2024-11-20')),
    });

    const result = await service.testOpenAIConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(1);
    expect(result.model).toBe('gpt-4o-2024-11-20');
    expect(mockResponsesCreate).toHaveBeenCalledTimes(3);
    expect(mockResponsesCreate.mock.calls.map((call) => call[0].max_output_tokens)).toEqual([
      256,
      256,
      512,
    ]);
    expect(JSON.stringify(result)).not.toContain('sk-test-openai-key');
  });

  it('runs two active Vertex model pairs separately and keeps their cache isolated', async () => {
    const vertexConfig = configFor('vertex', 'gemini-3.5-flash');
    vertexConfig.agents.GUIDE = {
      ...vertexConfig.agents.GUIDE,
      enabled: true,
      provider: 'vertex',
      model: 'gemini-3.6-flash',
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 6000,
    };
    prisma.promptVersion.findFirst.mockResolvedValue({ value: JSON.stringify(vertexConfig) });
    prisma.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        type: 'service_account',
        project_id: 'demo',
        client_email: 'a@b.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n',
      }),
    });
    configGet.mockImplementation((key: string) => (key === 'VERTEX_LOCATION' ? 'global' : undefined));

    const result = await service.testVertexConnection({ force: true });

    expect(result.success).toBe(true);
    expect(result.models.map((entry) => entry.model).sort()).toEqual([
      'gemini-3.5-flash',
      'gemini-3.6-flash',
    ]);
    expect(service.getModelProbe('vertex', 'gemini-3.5-flash')?.text).toBe('ok');
    expect(service.getModelProbe('vertex', 'gemini-3.6-flash')?.text).toBe('ok');

    service.clearProviderCache('vertex');
    expect(service.getModelProbe('vertex', 'gemini-3.5-flash')).toBeNull();
    expect(service.getModelProbe('vertex', 'gemini-3.6-flash')).toBeNull();
  });

  it('reuses a valid cache unless force=true', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );
    prisma.promptVersion.findFirst.mockResolvedValue({
      value: JSON.stringify(configFor('gemini', 'gemini-3.5-flash')),
    });

    await service.testGeminiConnection({ force: true });
    const firstCallCount = mockGenerateContent.mock.calls.length;
    await service.testGeminiConnection({ force: false });
    expect(mockGenerateContent).toHaveBeenCalledTimes(firstCallCount);
    await service.testGeminiConnection({ force: true });
    expect(mockGenerateContent.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('preserves fresh successful probes when runtime caches are invalidated after apply', async () => {
    configGet.mockImplementation((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-gemini-key' : undefined,
    );
    prisma.promptVersion.findFirst.mockResolvedValue({
      value: JSON.stringify(configFor('gemini', 'gemini-3.5-flash')),
    });

    await service.testGeminiConnection({ force: true });
    service.clearAllCaches();

    expect(service.getModelProbe('gemini', 'gemini-3.5-flash')?.text).toBe('ok');
  });

  describe('credential state priority', () => {
    type ResolveArgs = [
      boolean,
      'ok' | 'error' | 'not_tested',
      'ok' | 'error' | 'not_tested' | undefined,
      'ok' | 'error' | 'not_tested' | undefined,
      string | undefined,
      boolean?,
      boolean?,
    ];

    const resolveState = (...args: ResolveArgs) =>
      (
        service as unknown as {
          resolveCredentialState: (...inner: ResolveArgs) => string;
        }
      ).resolveCredentialState(...args);

    it('prioritizes quota and inaccessible-model categories', () => {
      expect(resolveState(true, 'error', 'not_tested', 'not_tested', 'quota')).toBe(
        'quota_billing',
      );
      expect(resolveState(true, 'error', 'not_tested', 'not_tested', 'model_not_found')).toBe(
        'model_inaccessible',
      );
    });

    it('returns connection_ok only when all required probes passed', () => {
      expect(resolveState(true, 'ok', 'ok', 'ok', undefined, true, true)).toBe(
        'connection_ok',
      );
      expect(resolveState(true, 'ok', 'not_tested', 'not_tested', undefined, false, false)).toBe(
        'connection_ok',
      );
      expect(resolveState(true, 'ok', 'not_tested', 'ok', undefined, true, true)).toBe(
        'not_tested',
      );
    });
  });

  it('keeps OpenAI constructor available to the test mock', () => {
    expect(OpenAI).toBeDefined();
  });
});
