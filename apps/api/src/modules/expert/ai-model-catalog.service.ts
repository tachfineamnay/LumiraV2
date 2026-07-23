import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GEMINI_V1_MODELS,
  OPENAI_V1_MODELS,
  VERTEX_V1_MODELS,
} from '../../services/factory/ai-model-config';
import {
  createGeminiDiscoveryClient,
  decryptSettingsValue,
  parseVertexServiceAccount,
  VERTEX_CREDENTIALS_KEY,
} from '../../services/factory/llm';
import { AiProvider } from '../../services/factory/ai-execution.types';

export interface DiscoveredOperationalModel {
  provider: 'openai' | 'gemini' | 'vertex';
  id: string;
  displayName: string;
  location?: string;
  discovery: 'provider_list' | 'model_garden';
  detected: boolean;
  /**
   * null = découvert mais pas encore testé.
   * true/false ne doit venir que du diagnostic ciblé, jamais de la découverte.
   */
  callable: boolean | null;
  supportedActions?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  thinking?: boolean;
  testedAt?: string;
  latencyMs?: number;
  errorCategory?: string;
  error?: string;
}

export interface ProviderModelCatalog {
  configured: boolean;
  models: DiscoveredOperationalModel[];
  error?: string;
  source: 'live' | 'supported' | 'unavailable' | 'error';
  location?: string;
  fetchedAt?: string;
  detectedCount?: number;
  callableCount?: number;
}

export interface AvailableModelsResponse {
  fetchedAt: string;
  openai: ProviderModelCatalog;
  gemini: ProviderModelCatalog;
  vertex: ProviderModelCatalog;
}

interface CacheEntry {
  expiresAt: number;
  payload: AvailableModelsResponse;
}

const CACHE_TTL_SUCCESS_MS = 15 * 60 * 1000;
const CACHE_TTL_ERROR_MS = 5 * 60 * 1000;
const DEFAULT_VERTEX_MODEL_GARDEN_LOCATION = 'us-central1';

/** Sanitise les logs et messages d'erreur pour éviter toute fuite de secret. */
export function sanitizeAiSecretString(input: string): string {
  if (!input) return '';
  return input
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted-openai-key]')
    .replace(/AIza[a-zA-Z0-9_-]+/g, '[redacted-gemini-key]')
    .replace(/ya29\.[a-zA-Z0-9_-]+/g, '[redacted-google-token]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [redacted-token]')
    .replace(
      /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
      '[redacted-private-key]',
    )
    .slice(0, 300);
}

@Injectable()
export class AiModelCatalogService {
  private readonly logger = new Logger(AiModelCatalogService.name);
  private cache: CacheEntry | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getAvailableModels(options?: { force?: boolean }): Promise<AvailableModelsResponse> {
    if (!options?.force && this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.payload;
    }

    // Découverte uniquement : aucun appel de génération et aucun coût de tokens ici.
    const [openai, gemini, vertex] = await Promise.all([
      this.discoverOpenAi(),
      this.discoverGemini(),
      this.discoverVertex(),
    ]);

    const payload: AvailableModelsResponse = {
      fetchedAt: new Date().toISOString(),
      openai,
      gemini,
      vertex,
    };
    const hasError = [openai, gemini, vertex].some(
      (catalog) => catalog.source === 'error' || catalog.source === 'unavailable',
    );
    this.cache = {
      payload,
      expiresAt: Date.now() + (hasError ? CACHE_TTL_ERROR_MS : CACHE_TTL_SUCCESS_MS),
    };
    return payload;
  }

  clearCache(): void {
    this.cache = null;
  }

  getVertexCatalogLocation(): string {
    return (
      this.configService.get<string>('VERTEX_MODEL_GARDEN_LOCATION')?.trim() ||
      DEFAULT_VERTEX_MODEL_GARDEN_LOCATION
    );
  }

  private async discoverGemini(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      return this.unavailable('GEMINI_API_KEY non configurée');
    }

    try {
      const client = createGeminiDiscoveryClient(apiKey);
      const models: DiscoveredOperationalModel[] = [];
      const seen = new Set<string>();
      const pager = await client.models.list();

      for await (const model of pager) {
        const rawName = typeof model.name === 'string' ? model.name : '';
        const id = rawName.replace(/^models\//, '').split('/').pop()?.trim() || '';
        if (!id || seen.has(id) || !/^gemini-/i.test(id)) continue;

        const actions = (model as { supportedActions?: string[] }).supportedActions ?? [];
        const methods =
          (model as { supportedGenerationMethods?: string[] }).supportedGenerationMethods ?? [];
        const supportedActions = [...new Set([...actions, ...methods])];
        if (
          supportedActions.length > 0 &&
          !supportedActions.some((method) => /generateContent/i.test(method))
        ) {
          continue;
        }
        if (this.isNonTextGenerationModel(id)) continue;

        seen.add(id);
        const displayName =
          typeof model.displayName === 'string' && model.displayName.trim()
            ? model.displayName.trim()
            : id;
        const description =
          typeof (model as { description?: string }).description === 'string'
            ? (model as { description?: string }).description || ''
            : '';

        models.push({
          provider: 'gemini',
          id,
          displayName,
          discovery: 'provider_list',
          detected: true,
          callable: null,
          supportedActions:
            supportedActions.length > 0 ? supportedActions : ['generateContent'],
          inputTokenLimit:
            typeof model.inputTokenLimit === 'number' ? model.inputTokenLimit : undefined,
          outputTokenLimit:
            typeof model.outputTokenLimit === 'number' ? model.outputTokenLimit : undefined,
          thinking:
            /thinking/i.test(id) ||
            /thinking/i.test(displayName) ||
            /thinking/i.test(description) ||
            Boolean((model as { thinking?: boolean }).thinking),
        });
      }

      return this.live(models);
    } catch (error) {
      return this.discoveryError('Gemini', error);
    }
  }

  private async discoverOpenAi(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      return this.unavailable('OPENAI_API_KEY non configurée');
    }

    try {
      const client = new OpenAI({ apiKey, maxRetries: 0 });
      const listed = await client.models.list();
      const models: DiscoveredOperationalModel[] = [];
      const seen = new Set<string>();

      for await (const model of listed) {
        const id = model.id?.trim();
        if (!id || seen.has(id) || !this.isOpenAiTextGenerationModel(id)) continue;
        seen.add(id);
        models.push({
          provider: 'openai',
          id,
          displayName: id,
          discovery: 'provider_list',
          detected: true,
          callable: null,
        });
      }

      return this.live(models);
    } catch (error) {
      return this.discoveryError('OpenAI', error);
    }
  }

  private async discoverVertex(): Promise<ProviderModelCatalog> {
    const location = this.getVertexCatalogLocation();
    const json = await this.loadVertexCredentialsJson();
    if (!json) {
      return this.unavailable('Identifiants Vertex non configurés', location);
    }

    try {
      const account = parseVertexServiceAccount(json);
      const auth = new GoogleAuth({
        credentials: {
          client_email: account.client_email,
          private_key: account.private_key,
          project_id: account.project_id,
          type: account.type,
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const tokenResponse = await authClient.getAccessToken();
      const accessToken = tokenResponse.token;
      if (!accessToken) {
        throw new Error('Impossible d’obtenir un jeton OAuth pour le compte de service Vertex.');
      }

      const models = await this.fetchVertexModelGardenCandidates(
        account.project_id,
        location,
        accessToken,
      );
      return this.live(models, location);
    } catch (error) {
      return this.discoveryError('Vertex', error, location);
    }
  }

  private async fetchVertexModelGardenCandidates(
    projectId: string,
    location: string,
    accessToken: string,
  ): Promise<DiscoveredOperationalModel[]> {
    const models: DiscoveredOperationalModel[] = [];
    const seen = new Set<string>();
    let pageToken: string | undefined;

    do {
      const url = new URL(
        `https://${location}-aiplatform.googleapis.com/v1beta1/publishers/google/models`,
      );
      url.searchParams.set('listAllVersions', 'true');
      url.searchParams.set('view', 'PUBLISHER_MODEL_VERSION_VIEW_BASIC');
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-goog-user-project': projectId,
        },
      });
      if (!response.ok) {
        const body = sanitizeAiSecretString(await response.text());
        throw new Error(`Catalogue Vertex HTTP ${response.status}${body ? ` : ${body}` : ''}`);
      }

      const data = (await response.json()) as {
        publisherModels?: Array<{
          name?: string;
          displayName?: string;
          supportedActions?: string[];
          inputTokenLimit?: number;
          outputTokenLimit?: number;
        }>;
        models?: Array<{
          name?: string;
          displayName?: string;
          supportedActions?: string[];
          inputTokenLimit?: number;
          outputTokenLimit?: number;
        }>;
        nextPageToken?: string;
      };

      for (const model of data.publisherModels ?? data.models ?? []) {
        const name = model.name ?? '';
        const id = name.split('/models/').pop()?.split('@')[0]?.trim() || '';
        if (!id || seen.has(id) || !/^gemini-/i.test(id)) continue;
        if (this.isNonTextGenerationModel(id)) continue;

        seen.add(id);
        models.push({
          provider: 'vertex',
          id,
          displayName: model.displayName?.trim() || id,
          location,
          discovery: 'model_garden',
          detected: true,
          callable: null,
          supportedActions: model.supportedActions,
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit,
        });
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return models;
  }

  private isOpenAiTextGenerationModel(id: string): boolean {
    const lower = id.toLowerCase();
    if (
      /embedding|moderation|audio|realtime|transcri|whisper|tts|dall-e|image|search|babbage|davinci/.test(
        lower,
      )
    ) {
      return false;
    }
    return /^(gpt-|chatgpt-|o\d|computer-use)/i.test(id);
  }

  private isNonTextGenerationModel(id: string): boolean {
    return /embedding|imagen|veo|image|live|audio|tts|speech|aqa/i.test(id);
  }

  private live(models: DiscoveredOperationalModel[], location?: string): ProviderModelCatalog {
    return {
      configured: true,
      models,
      source: 'live',
      location,
      fetchedAt: new Date().toISOString(),
      detectedCount: models.length,
      callableCount: 0,
    };
  }

  private unavailable(error: string, location?: string): ProviderModelCatalog {
    return {
      configured: false,
      models: [],
      source: 'unavailable',
      error,
      location,
      detectedCount: 0,
      callableCount: 0,
    };
  }

  private discoveryError(
    provider: string,
    error: unknown,
    location?: string,
  ): ProviderModelCatalog {
    const safeError = sanitizeAiSecretString(
      error instanceof Error ? error.message : String(error),
    );
    this.logger.warn(`${provider} model discovery failed: ${safeError}`);
    return {
      configured: true,
      models: [],
      source: 'error',
      error: safeError,
      location,
      detectedCount: 0,
      callableCount: 0,
    };
  }

  private async loadVertexCredentialsJson(): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: VERTEX_CREDENTIALS_KEY },
    });
    if (!setting?.value) return null;
    return decryptSettingsValue(
      setting.value,
      this.configService.get<string>('SETTINGS_ENCRYPTION_KEY'),
    );
  }
}

/** Legacy seed helper kept only for historical compatibility and migrations. */
export function legacySeedModelIds(provider: AiProvider): readonly string[] {
  if (provider === 'openai') return OPENAI_V1_MODELS;
  if (provider === 'vertex') return VERTEX_V1_MODELS;
  return GEMINI_V1_MODELS;
}
