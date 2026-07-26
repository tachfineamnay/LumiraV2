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

describe('AiModelCatalogService — discovery & matrix merging', () => {
  const prisma = {
    systemSetting: { findUnique: jest.fn() },
  };
  const configGet = jest.fn((key: string) => {
    if (key === 'OPENAI_API_KEY') return 'sk-test-key-12345';
    if (key === 'GEMINI_API_KEY') return 'AIzaSyTestKey67890';
    if (key === 'VERTEX_LOCATION') return 'europe-west1';
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
    (GoogleGenAI as unknown as jest.Mock).mockImplementation((options: { apiVersion?: string }) =>
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

  it('découvre les modèles Gemini generateContent et fusionne les modèles enregistrés non détectés', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(geminiList).toHaveBeenCalledTimes(1);
    const discovered = catalog.gemini.models.find((m) => m.id === 'gemini-3.5-flash');
    expect(discovered).toBeDefined();
    expect(discovered?.detected).toBe(true);
    expect(discovered?.callable).toBeNull();
    expect(discovered?.maxOutputTokens).toBe(65536);

    const mergedNotDetected = catalog.gemini.models.find((m) => m.id === 'gemini-3.6-flash');
    expect(mergedNotDetected).toBeDefined();
    expect(mergedNotDetected?.detected).toBe(false);
    expect(mergedNotDetected?.callable).toBeNull();
    expect(mergedNotDetected?.operational).toBe(true);
  });

  it('découvre les familles OpenAI génératives et fusionne les modèles enregistrés manquants', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(openaiMock.__mockList).toHaveBeenCalledTimes(1);
    const gpt55 = catalog.openai.models.find((m) => m.id === 'gpt-5.5-2026-04-23');
    expect(gpt55?.detected).toBe(true);
    expect(gpt55?.maxOutputTokens).toBe(128000);

    const gpt54Merged = catalog.openai.models.find((m) => m.id === 'gpt-5.4-2026-03-05');
    expect(gpt54Merged?.detected).toBe(false);
    expect(gpt54Merged?.callable).toBeNull();
    expect(gpt54Merged?.operational).toBe(true);
  });

  it('utilise us-central1 pour le catalogue Model Garden et n’appelle jamais global-aiplatform.googleapis.com', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('us-central1-aiplatform.googleapis.com');
    expect(url).not.toContain('global-aiplatform.googleapis.com');
    expect(catalog.vertex.location).toBe('us-central1');
  });

  it('conserve les modèles enregistrés comme detected=false lorsque les identifiants manquent', async () => {
    const noCredentials = new AiModelCatalogService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      {
        systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      } as unknown as PrismaService,
    );
    const catalog = await noCredentials.getAvailableModels({ force: true });
    expect(catalog.openai.detectedCount).toBe(0);
    expect(catalog.openai.models.every((m) => m.detected === false)).toBe(true);
    expect(catalog.openai.models.some((m) => m.id === 'gpt-5.5-2026-04-23')).toBe(true);
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
});
