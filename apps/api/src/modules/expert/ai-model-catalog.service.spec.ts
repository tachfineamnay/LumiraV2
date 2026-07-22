import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
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

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

const openaiModule = jest.requireMock('openai') as {
  __mockList: jest.Mock;
};

async function* asPager(models: Array<Record<string, unknown>>) {
  for (const model of models) yield model;
}

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
  let geminiList: jest.Mock;
  let vertexList: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    geminiList = jest.fn();
    vertexList = jest.fn();
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
    geminiList.mockResolvedValue(
      asPager([
        {
          name: 'models/gemini-2.5-flash',
          supportedActions: ['generateContent'],
        },
        {
          name: 'models/embedding-001',
          supportedActions: ['embedContent'],
        },
      ]),
    );
    vertexList.mockRejectedValue(new Error('no reliable list'));

    (GoogleGenAI as unknown as jest.Mock).mockImplementation(
      (options: { vertexai?: boolean; apiKey?: string }) => {
        if (options.vertexai) {
          return { models: { list: vertexList } };
        }
        return { models: { list: geminiList } };
      },
    );

    service = new AiModelCatalogService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('lists live OpenAI/Gemini intersected with allowlist; Vertex uses supported when list fails', async () => {
    const first = await service.getAvailableModels();
    expect(first.openai.source).toBe('live');
    expect(first.openai.models.filter((m) => m.status === 'verified').map((m) => m.id)).toEqual([
      'gpt-4o-2024-11-20',
    ]);
    expect(first.gemini.source).toBe('live');
    expect(first.gemini.models.filter((m) => m.status === 'verified').map((m) => m.id)).toEqual([
      'gemini-2.5-flash',
    ]);
    expect(first.vertex.source).toBe('supported');
    expect(first.vertex.models.every((m) => m.status === 'supported')).toBe(true);
    expect(first.vertex.location).toBe('us-central1');
    expect(first.vertex.error).toMatch(/non vérifiée/i);

    openaiModule.__mockList.mockClear();
    geminiList.mockClear();
    const second = await service.getAvailableModels();
    expect(second).toBe(first);
    expect(openaiModule.__mockList).not.toHaveBeenCalled();
    expect(geminiList).not.toHaveBeenCalled();
  });

  it('does not promote empty live ∩ allowlist as a fake live catalog', async () => {
    openaiModule.__mockList.mockResolvedValueOnce({
      data: [
        { id: 'gpt-4o-mini-2024-07-18', owned_by: 'openai', created: 1 },
        { id: 'gpt-3.5-turbo', owned_by: 'openai', created: 2 },
      ],
    });
    service.clearCache();

    const payload = await service.getAvailableModels({ force: true });
    expect(payload.openai.source).toBe('supported');
    expect(payload.openai.models.every((m) => m.status === 'supported')).toBe(true);
    expect(payload.openai.error).toMatch(/non vérifiée|Aucun modèle Lumira/i);
  });

  it('forces refresh when requested', async () => {
    await service.getAvailableModels();
    openaiModule.__mockList.mockClear();
    await service.getAvailableModels({ force: true });
    expect(openaiModule.__mockList).toHaveBeenCalled();
  });

  it('returns supported (not live) when providers fail', async () => {
    openaiModule.__mockList.mockRejectedValueOnce(new Error('openai down'));
    geminiList.mockRejectedValueOnce(new Error('gemini down'));
    service.clearCache();

    const payload = await service.getAvailableModels({ force: true });
    expect(payload.openai.source).toBe('error');
    expect(payload.openai.models.length).toBeGreaterThan(0);
    expect(payload.openai.models[0].status).toBe('supported');
    expect(payload.gemini.source).toBe('error');
    expect(payload.vertex.source).toBe('supported');
  });

  it('uses the same VERTEX_LOCATION as runtime', () => {
    expect(service.getVertexLocation()).toBe('us-central1');
  });
});
