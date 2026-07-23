import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiModelCatalogService, sanitizeAiSecretString } from './ai-model-catalog.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('openai', () => {
  const list = jest.fn();
  const responsesCreate = jest.fn();
  const chatCompletionsCreate = jest.fn();

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      models: { list },
      responses: { create: responsesCreate },
      chat: { completions: { create: chatCompletionsCreate } },
    })),
    __mockList: list,
    __mockResponsesCreate: responsesCreate,
    __mockChatCompletionsCreate: chatCompletionsCreate,
  };
});

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

jest.mock('google-auth-library', () => {
  return {
    GoogleAuth: jest.fn().mockImplementation(() => ({
      getClient: jest.fn().mockResolvedValue({
        getAccessToken: jest.fn().mockResolvedValue({ token: 'ya29.test-access-token' }),
      }),
    })),
  };
});

const openaiModule = jest.requireMock('openai') as {
  __mockList: jest.Mock;
  __mockResponsesCreate: jest.Mock;
  __mockChatCompletionsCreate: jest.Mock;
};

async function* asPager<T>(items: T[]) {
  for (const item of items) yield item;
}

describe('AiModelCatalogService (Dynamic Discovery & Probing)', () => {
  const prisma = {
    systemSetting: {
      findUnique: jest.fn(),
    },
  };

  const configGet = jest.fn((key: string) => {
    if (key === 'OPENAI_API_KEY') return 'sk-test-key-12345';
    if (key === 'GEMINI_API_KEY') return 'AIzaSyTestKey67890';
    if (key === 'VERTEX_LOCATION') return 'us-central1';
    if (key === 'SETTINGS_ENCRYPTION_KEY') return undefined;
    return undefined;
  });

  let service: AiModelCatalogService;
  let geminiDiscoveryList: jest.Mock;
  let geminiProdGenerateContent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    geminiDiscoveryList = jest.fn();
    geminiProdGenerateContent = jest.fn();

    openaiModule.__mockList.mockReturnValue(
      asPager([
        { id: 'gpt-4o-2024-11-20' },
        { id: 'gpt-5.5-2026-04-23' },
        { id: 'text-embedding-3-small' },
      ]),
    );

    openaiModule.__mockResponsesCreate.mockResolvedValue({
      output_text: 'OK',
    });

    prisma.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        type: 'service_account',
        project_id: 'test-vertex-project',
        client_email: 'test@test-vertex-project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nSecretKeyPEM\n-----END PRIVATE KEY-----\n',
      }),
    });

    geminiDiscoveryList.mockReturnValue(
      asPager([
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedActions: ['generateContent'],
          inputTokenLimit: 1000000,
          outputTokenLimit: 8192,
        },
        {
          name: 'models/embedding-001',
          displayName: 'Embedding 001',
          supportedActions: ['embedContent'],
        },
      ]),
    );

    geminiProdGenerateContent.mockResolvedValue({ text: 'OK' });

    (GoogleGenAI as unknown as jest.Mock).mockImplementation(
      (options: { vertexai?: boolean; apiVersion?: string }) => {
        if (options.apiVersion === 'v1beta') {
          return { models: { list: geminiDiscoveryList } };
        }
        return { models: { generateContent: geminiProdGenerateContent } };
      },
    );

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        publisherModels: [
          { name: 'publishers/google/models/gemini-2.5-pro' },
          { name: 'publishers/google/models/gemini-2.5-flash' },
        ],
      }),
    }) as jest.Mock;

    service = new AiModelCatalogService(
      { get: configGet } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('1. Gemini models.list parcourt toutes les pages et extrait les candidats', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(geminiDiscoveryList).toHaveBeenCalled();
    expect(catalog.gemini.models.some((m) => m.id === 'gemini-2.5-flash')).toBe(true);
  });

  it('2. Seuls les modèles gérant generateContent sont retenus (les embeddings sont filtrés)', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(catalog.gemini.models.some((m) => m.id === 'embedding-001')).toBe(false);
  });

  it('3. Normalise models/gemini-x en gemini-x', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    const geminiFlash = catalog.gemini.models.find((m) => m.id === 'gemini-2.5-flash');
    expect(geminiFlash).toBeDefined();
    expect(geminiFlash?.id).toBe('gemini-2.5-flash');
  });

  it('4. OpenAI models.list est réellement utilisé', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(openaiModule.__mockList).toHaveBeenCalled();
    expect(catalog.openai.models.some((m) => m.id === 'gpt-4o-2024-11-20')).toBe(true);
  });

  it('5. Un modèle OpenAI listé mais incompatible Responses/probe est inaccessible (callable: false)', async () => {
    openaiModule.__mockResponsesCreate.mockRejectedValueOnce(new Error('model_not_found'));
    const catalog = await service.getAvailableModels({ force: true });
    const model = catalog.openai.models.find((m) => m.id === 'gpt-4o-2024-11-20');
    expect(model?.callable).toBe(false);
    expect(model?.errorCategory).toBe('model_not_found');
  });

  it('6. Un modèle OpenAI avec probe réussi est fonctionnel (callable: true)', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    const model = catalog.openai.models.find((m) => m.id === 'gpt-4o-2024-11-20');
    expect(model?.callable).toBe(true);
  });

  it('7. Vertex utilise le project_id du compte de service et effectue la requête REST', async () => {
    const catalog = await service.getAvailableModels({ force: true });
    expect(catalog.vertex.configured).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toContain('us-central1-aiplatform.googleapis.com');
  });

  it('8 & 14. Sanitisation des secrets (sk-..., AIza..., ya29..., Bearer..., PEM)', () => {
    const textWithError =
      'Error with sk-proj-123456 and AIzaSy789 and ya29.abc and Bearer xyz and -----BEGIN PRIVATE KEY-----\nMYKEY\n-----END PRIVATE KEY-----';
    const sanitized = sanitizeAiSecretString(textWithError);
    expect(sanitized).not.toContain('sk-proj-123456');
    expect(sanitized).not.toContain('AIzaSy789');
    expect(sanitized).not.toContain('ya29.abc');
    expect(sanitized).not.toContain('MYKEY');
    expect(sanitized).toContain('[redacted-openai-key]');
    expect(sanitized).toContain('[redacted-gemini-key]');
  });

  it('12. Un modèle en quota est inaccessible avec errorCategory quota_billing', async () => {
    geminiProdGenerateContent.mockRejectedValueOnce(
      new Error('Quota exceeded for project / 429 quota_billing'),
    );
    const catalog = await service.getAvailableModels({ force: true });
    const geminiModel = catalog.gemini.models.find((m) => m.id === 'gemini-2.5-flash');
    expect(geminiModel?.callable).toBe(false);
    expect(geminiModel?.errorCategory).toBe('quota_billing');
  });

  it('13. Une réponse vide n’est jamais fonctionnelle (callable: false)', async () => {
    geminiProdGenerateContent.mockResolvedValueOnce({ text: '   ' });
    const catalog = await service.getAvailableModels({ force: true });
    const geminiModel = catalog.gemini.models.find((m) => m.id === 'gemini-2.5-flash');
    expect(geminiModel?.callable).toBe(false);
  });

  it('15. Parcours les pages successives avec pageToken pour Vertex Model Garden', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          publisherModels: [{ name: 'publishers/google/models/gemini-2.5-flash' }],
          nextPageToken: 'token-page-2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          publisherModels: [{ name: 'publishers/google/models/gemini-2.5-pro' }],
        }),
      });

    const catalog = await service.getAvailableModels({ force: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondCallUrl = (global.fetch as jest.Mock).mock.calls[1][0];
    expect(secondCallUrl).toContain('pageToken=token-page-2');
    expect(catalog.vertex.models.some((m) => m.id === 'gemini-2.5-pro')).toBe(true);
  });
});
