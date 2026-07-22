import { ConfigService } from '@nestjs/config';
import { AiModelCatalogService } from './ai-model-catalog.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('openai', () => {
  const list = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      models: { list },
    })),
    __mockList: list,
  };
});

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: async () => ({
      getAccessToken: async () => ({ token: 'test-token' }),
    }),
  })),
}));

const openaiModule = jest.requireMock('openai') as {
  __mockList: jest.Mock;
};

describe('AiModelCatalogService', () => {
  const prisma = {
    systemSetting: {
      findUnique: jest.fn(),
    },
  };

  const configGet = jest.fn((key: string) => {
    if (key === 'OPENAI_API_KEY') return 'sk-test';
    if (key === 'GEMINI_API_KEY') return 'gemini-test';
    if (key === 'VERTEX_LOCATION') return 'us-central1';
    if (key === 'SETTINGS_ENCRYPTION_KEY') return undefined;
    return undefined;
  });

  let service: AiModelCatalogService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    openaiModule.__mockList.mockResolvedValue({
      data: [
        { id: 'gpt-4o-2024-11-20', owned_by: 'openai', created: 1 },
        { id: 'text-embedding-3-small', owned_by: 'openai', created: 2 },
        { id: 'gpt-4o-mini-2024-07-18', owned_by: 'openai', created: 3 },
      ],
    });
    prisma.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        type: 'service_account',
        project_id: 'demo-project',
        client_email: 'demo@demo.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n',
      }),
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                name: 'models/gemini-2.5-flash',
                displayName: 'Gemini 2.5 Flash',
                supportedGenerationMethods: ['generateContent'],
              },
              {
                name: 'models/embedding-001',
                displayName: 'Embedding',
                supportedGenerationMethods: ['embedContent'],
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          publisherModels: [
            { name: 'publishers/google/models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
            { name: 'publishers/google/models/textembedding-gecko', displayName: 'Embedding' },
          ],
        }),
      };
    });

    service = new AiModelCatalogService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('lists live OpenAI/Gemini/Vertex models and caches for an hour', async () => {
    const first = await service.getAvailableModels();
    expect(first.openai.source).toBe('live');
    expect(first.openai.models.map((m) => m.id)).toEqual([
      'gpt-4o-2024-11-20',
      'gpt-4o-mini-2024-07-18',
    ]);
    expect(first.gemini.source).toBe('live');
    expect(first.gemini.models.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    expect(first.vertex.source).toBe('live');
    expect(first.vertex.models.map((m) => m.id)).toEqual(['gemini-2.5-pro']);

    openaiModule.__mockList.mockClear();
    fetchMock.mockClear();
    const second = await service.getAvailableModels();
    expect(second).toBe(first);
    expect(openaiModule.__mockList).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forces refresh when requested', async () => {
    await service.getAvailableModels();
    openaiModule.__mockList.mockClear();
    await service.getAvailableModels({ force: true });
    expect(openaiModule.__mockList).toHaveBeenCalled();
  });

  it('falls back to seed catalogs when providers fail', async () => {
    openaiModule.__mockList.mockRejectedValueOnce(new Error('openai down'));
    fetchMock.mockRejectedValue(new Error('network'));
    service.clearCache();

    const payload = await service.getAvailableModels({ force: true });
    expect(payload.openai.source).toBe('seed');
    expect(payload.openai.models.length).toBeGreaterThan(0);
    expect(payload.gemini.source).toBe('seed');
    expect(payload.vertex.source).toBe('seed');
  });
});
