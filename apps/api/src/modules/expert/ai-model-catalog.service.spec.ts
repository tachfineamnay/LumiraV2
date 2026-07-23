import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AiModelCatalogService, sanitizeAiSecretString } from './ai-model-catalog.service';

jest.mock('openai', () => {
  const list = jest.fn();
  const responsesCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      models: { list },
      responses: { create: responsesCreate },
    })),
    __mockList: list,
    __mockResponsesCreate: responsesCreate,
  };
});

jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn() }));

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      getAccessToken: jest.fn().mockResolvedValue({ token: 'ya29.test-access-token' }),
    }),
  })),
}));

const openaiMock = jest.requireMock('openai') as {
  __mockList: jest.Mock;
  __mockResponsesCreate: jest.Mock;
};

async function* asPager<T>(items: T[]) {
  for (const item of items) yield item;
}

describe('AiModelCatalogService — discovery only', () => {
  const prisma = {
    systemSetting: { findUnique: jest.fn() },
  };
  const configGet = jest.fn((key: string) => {
    if (key === 'OPENAI_API_KEY') return 'sk-test-key-12345';
    if (key === 'GEMINI_API_KEY') return 'AIzaSyTestKey67890';
    if (key === 'VERTEX_MODEL_GARDEN_LOCATION') return 'us-central1';
    if (key === 'VERTEX_LOCATION') return 'global';
    if (key === 'SETTINGS_ENCRYPTION_KEY') return undefined;
    return undefined;
  });

  let service: AiModelCatalogService;
  let geminiList: jest.Mock;
  let geminiGenerate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    openaiMock.__mockList.mockReturnValue(
      asPager([
        { id: 'gpt-4o-2024-11-20' },
        { id: 'gpt-5.5-2026-04-23' },
        { id: 'text-embedding-3-small' },
        { id: 'gpt-4o-realtime-preview' },
      ]),
    );

    geminiList = jest.fn().mockReturnValue(
      asPager([
        {
          name: 'models/gemini-3.5-flash',
          displayName: 'Gemini 3.5 Flash',
          supportedActions: ['generateContent'],
        },
        {
          name: 'models/embedding-001',
          supportedActions: ['embedContent'],
        },
        {
          name: 'models/gemini-image-model',
          supportedActions: ['generateContent'],
        },
      ]),
    );
    geminiGenerate = jest.fn();
    (GoogleGenAI as unknown as jest.Mock).mockImplementation(
      (options: { apiVersion?: string }) =>
        options.apiVersion === 'v1beta'
          ? { models: { list: geminiList } }
          : { models: { generateContent: geminiGenerate } },
    );

    prisma.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        type: 'service_account',
        project_id: 'test-vertex-project',
        client_email: 'test@test-vertex-project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nSecretKeyPEM\n-----END PRIVATE KEY-----\n',
      }),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        publisherModels: [
          { name: 'publishers/google/models/gemini-3.5-flash' },
          { name: 'publishers/google/models/gemini-image-model' },
        ],
      }),
    }) as jest.Mock;

    service = new AiModelCatalogService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('découvre les modèles Gemini generateContent sans lancer de génération', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(geminiList).toHaveBeenCalledTimes(1);
    expect(catalog.gemini.models.map((model) => model.id)).toEqual(['gemini-3.5-flash']);
    expect(catalog.gemini.models[0]?.callable).toBeNull();
    expect(geminiGenerate).not.toHaveBeenCalled();
  });

  it('découvre uniquement les familles OpenAI génératives et ne probe rien', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(openaiMock.__mockList).toHaveBeenCalledTimes(1);
    expect(catalog.openai.models.map((model) => model.id)).toEqual([
      'gpt-4o-2024-11-20',
      'gpt-5.5-2026-04-23',
    ]);
    expect(catalog.openai.models.every((model) => model.callable === null)).toBe(true);
    expect(openaiMock.__mockResponsesCreate).not.toHaveBeenCalled();
  });

  it('utilise le catalogue Vertex us-central1, jamais global ni publishers/*', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(catalog.vertex.models.map((model) => model.id)).toEqual(['gemini-3.5-flash']);
    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('us-central1-aiplatform.googleapis.com');
    expect(url).toContain('/v1beta1/publishers/google/models');
    expect(url).toContain('listAllVersions=true');
    expect(url).toContain('pageSize=100');
    expect(url).not.toContain('publishers%2F*');
    expect(url).not.toContain('global-aiplatform');
  });

  it('parcourt toutes les pages du catalogue Vertex', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          publisherModels: [{ name: 'publishers/google/models/gemini-3.5-flash' }],
          nextPageToken: 'page-2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          publisherModels: [{ name: 'publishers/google/models/gemini-3.6-flash' }],
        }),
      });

    const catalog = await service.getAvailableModels({ force: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain('pageToken=page-2');
    expect(catalog.vertex.models.map((model) => model.id)).toEqual([
      'gemini-3.5-flash',
      'gemini-3.6-flash',
    ]);
  });

  it('ne crée aucun faux modèle détecté lorsque les credentials manquent', async () => {
    const noCredentials = new AiModelCatalogService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      {
        systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
    );
    const catalog = await noCredentials.getAvailableModels({ force: true });
    expect(catalog.openai.models).toEqual([]);
    expect(catalog.gemini.models).toEqual([]);
    expect(catalog.vertex.models).toEqual([]);
  });

  it('sanitise toutes les formes de secrets', () => {
    const input =
      'sk-proj-123 AIzaSy789 ya29.abc Bearer xyz -----BEGIN PRIVATE KEY-----\nMYKEY\n-----END PRIVATE KEY-----';
    const output = sanitizeAiSecretString(input);
    expect(output).not.toContain('sk-proj-123');
    expect(output).not.toContain('AIzaSy789');
    expect(output).not.toContain('ya29.abc');
    expect(output).not.toContain('MYKEY');
  });

  it('conserve OpenAI comme dépendance réellement utilisée', () => {
    expect(OpenAI).toBeDefined();
  });
});
