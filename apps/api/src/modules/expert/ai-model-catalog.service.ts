import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GEMINI_V1_MODELS,
  LUMIRA_SUPPORTED_MODELS,
  OPENAI_V1_MODELS,
  VERTEX_V1_MODELS,
} from '../../services/factory/ai-model-config';
import {
  createGeminiDeveloperClient,
  createVertexAiClient,
  decryptSettingsValue,
  parseVertexServiceAccount,
  resolveVertexLocation,
  VERTEX_CREDENTIALS_KEY,
} from '../../services/factory/llm';
import { AiProvider } from '../../services/factory/ai-execution.types';

export type ModelCatalogStatus = 'verified' | 'supported' | 'unavailable' | 'unknown';

export type ModelCatalogSource = 'live' | 'supported' | 'unavailable' | 'error';

export interface ModelCatalogEntry {
  id: string;
  label: string;
  ownedBy?: string;
  createdAt?: number;
  /** Availability relative to the account / provider. */
  status: ModelCatalogStatus;
}

export interface ProviderModelCatalog {
  configured: boolean;
  models: ModelCatalogEntry[];
  error?: string;
  /**
   * `live` = listed by the provider API and intersected with Lumira allowlist.
   * `supported` = Lumira allowlist only (not confirmed live).
   * `unavailable` = provider not configured.
   * `error` = listing failed; models may still show supported (unverified).
   */
  source: ModelCatalogSource;
  location?: string;
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

const CACHE_TTL_MS = 60 * 60 * 1000;

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

    const [openai, gemini, vertex] = await Promise.all([
      this.listOpenAiModels(),
      this.listGeminiModels(),
      this.listVertexModels(),
    ]);

    const payload: AvailableModelsResponse = {
      fetchedAt: new Date().toISOString(),
      openai,
      gemini,
      vertex,
    };
    this.cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return payload;
  }

  clearCache(): void {
    this.cache = null;
  }

  getVertexLocation(): string {
    return resolveVertexLocation(this.configService);
  }

  private async listOpenAiModels(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      return {
        configured: false,
        models: this.supportedEntries('openai', 'unknown'),
        source: 'unavailable',
        error: 'OPENAI_API_KEY non configurée',
      };
    }

    try {
      const client = new OpenAI({ apiKey, maxRetries: 0 });
      const listed = await client.models.list();
      const liveIds = new Set(
        listed.data.map((model) => model.id).filter((id) => this.isOpenAiGenerativeModel(id)),
      );
      return this.intersectWithAllowlist('openai', liveIds, true);
    } catch (error) {
      this.logger.warn(`OpenAI model catalog failed: ${this.safeError(error)}`);
      return {
        configured: true,
        models: this.supportedEntries('openai', 'supported'),
        source: 'error',
        error: this.safeError(error),
      };
    }
  }

  private async listGeminiModels(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      return {
        configured: false,
        models: this.supportedEntries('gemini', 'unknown'),
        source: 'unavailable',
        error: 'GEMINI_API_KEY non configurée',
      };
    }

    try {
      const client = createGeminiDeveloperClient(apiKey);
      const liveIds = await this.listGenerateContentModelIds(client);
      return this.intersectWithAllowlist('gemini', liveIds, true);
    } catch (error) {
      this.logger.warn(`Gemini model catalog failed: ${this.safeError(error)}`);
      return {
        configured: true,
        models: this.supportedEntries('gemini', 'supported'),
        source: 'error',
        error: this.safeError(error),
      };
    }
  }

  /**
   * Vertex: no undocumented REST list as source of truth.
   * Prefer official SDK pager when available; otherwise return explicit
   * Lumira-supported models marked as `supported` (never as live).
   */
  private async listVertexModels(): Promise<ProviderModelCatalog> {
    const location = this.getVertexLocation();
    const json = await this.loadVertexCredentialsJson();
    if (!json) {
      return {
        configured: false,
        models: this.supportedEntries('vertex', 'unknown'),
        source: 'unavailable',
        error: 'Identifiants Vertex non configurés',
        location,
      };
    }

    try {
      const account = parseVertexServiceAccount(json);
      const client = createVertexAiClient(account, location);
      try {
        const liveIds = await this.listGenerateContentModelIds(client);
        if (liveIds.size > 0) {
          const catalog = this.intersectWithAllowlist('vertex', liveIds, true);
          return { ...catalog, location };
        }
      } catch (listError) {
        this.logger.warn(
          `Vertex SDK model list unavailable, using supported allowlist: ${this.safeError(listError)}`,
        );
      }

      // Honest: supported by Lumira, not confirmed live for this project/region.
      return {
        configured: true,
        models: this.supportedEntries('vertex', 'supported'),
        source: 'supported',
        location,
        error:
          'Liste supportée non vérifiée — le SDK n’a pas renvoyé de catalogue live fiable pour ce projet/région.',
      };
    } catch (error) {
      this.logger.warn(`Vertex model catalog failed: ${this.safeError(error)}`);
      return {
        configured: true,
        models: this.supportedEntries('vertex', 'supported'),
        source: 'error',
        location,
        error: this.safeError(error),
      };
    }
  }

  private async listGenerateContentModelIds(client: GoogleGenAI): Promise<Set<string>> {
    const ids = new Set<string>();
    const pager = await client.models.list({ config: { pageSize: 100 } });
    for await (const model of pager) {
      const rawName = typeof model.name === 'string' ? model.name : '';
      const id =
        rawName
          .replace(/^models\//, '')
          .split('/')
          .pop() || '';
      if (!id) continue;
      const actions = (model as { supportedActions?: string[] }).supportedActions ?? [];
      const methods =
        (model as { supportedGenerationMethods?: string[] }).supportedGenerationMethods ?? [];
      const canGenerate =
        actions.length === 0 && methods.length === 0
          ? /gemini/i.test(id)
          : [...actions, ...methods].some((method) => /generateContent/i.test(method));
      if (canGenerate) ids.add(id);
    }
    return ids;
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

  private supportedEntries(provider: AiProvider, status: ModelCatalogStatus): ModelCatalogEntry[] {
    const ids = LUMIRA_SUPPORTED_MODELS[provider];
    return ids.map((id) => ({ id, label: id, status }));
  }

  /**
   * Intersect live IDs with Lumira allowlist.
   * Never promote allowlist seeds as `live` when the intersection is empty.
   */
  private intersectWithAllowlist(
    provider: AiProvider,
    liveIds: Set<string>,
    configured: boolean,
  ): ProviderModelCatalog {
    const allowlist = LUMIRA_SUPPORTED_MODELS[provider];
    const verified = allowlist
      .filter((id) => liveIds.has(id))
      .map((id) => ({ id, label: id, status: 'verified' as const }));

    if (verified.length === 0) {
      return {
        configured,
        models: allowlist.map((id) => ({
          id,
          label: id,
          status: 'supported' as const,
        })),
        source: 'supported',
        error:
          'Aucun modèle Lumira confirmé dans le catalogue live — liste supportée non vérifiée.',
      };
    }

    const missing = allowlist
      .filter((id) => !liveIds.has(id))
      .map((id) => ({ id, label: id, status: 'unavailable' as const }));

    return {
      configured,
      models: [...verified, ...missing],
      source: 'live',
    };
  }

  private isOpenAiGenerativeModel(id: string): boolean {
    const lower = id.toLowerCase();
    if (
      /embedding|tts|whisper|dall-e|moderation|transcribe|realtime|audio|image|codex|babbage|davinci|search/i.test(
        lower,
      )
    ) {
      return false;
    }
    return /^(gpt-|o\d|chatgpt-|ft:)/i.test(lower);
  }

  private safeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted]').slice(0, 200);
  }
}

/** @deprecated seed helpers kept for Desk fallback labels only */
export function legacySeedModelIds(provider: AiProvider): readonly string[] {
  if (provider === 'openai') return OPENAI_V1_MODELS;
  if (provider === 'vertex') return VERTEX_V1_MODELS;
  return GEMINI_V1_MODELS;
}
