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
  decryptSettingsValue,
  parseVertexServiceAccount,
  VERTEX_CREDENTIALS_KEY,
} from '../../services/factory/llm';
import { AiProvider } from '../../services/factory/ai-execution.types';

export interface ModelCatalogEntry {
  id: string;
  label: string;
  ownedBy?: string;
  createdAt?: number;
}

export interface ProviderModelCatalog {
  configured: boolean;
  models: ModelCatalogEntry[];
  error?: string;
  source: 'live' | 'seed' | 'unavailable';
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

  private async listOpenAiModels(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      return {
        configured: false,
        models: this.seedEntries('openai'),
        source: 'seed',
        error: 'OPENAI_API_KEY non configurée',
      };
    }

    try {
      const client = new OpenAI({ apiKey, maxRetries: 0 });
      const listed = await client.models.list();
      const models = listed.data
        .map((model) => ({
          id: model.id,
          label: model.id,
          ownedBy: model.owned_by,
          createdAt: model.created,
        }))
        .filter((model) => this.isOpenAiGenerativeModel(model.id))
        .sort((a, b) => a.id.localeCompare(b.id));

      return this.operationalOrSeed('openai', models, true);
    } catch (error) {
      this.logger.warn(`OpenAI model catalog failed: ${this.safeError(error)}`);
      return {
        configured: true,
        models: this.seedEntries('openai'),
        source: 'seed',
        error: this.safeError(error),
      };
    }
  }

  private async listGeminiModels(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      return {
        configured: false,
        models: this.seedEntries('gemini'),
        source: 'seed',
        error: 'GEMINI_API_KEY non configurée',
      };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!response.ok) {
        throw new Error(`Gemini listModels HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        models?: Array<{
          name?: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const models = (body.models ?? [])
        .filter((model) =>
          (model.supportedGenerationMethods ?? []).some((method) =>
            /generateContent/i.test(method),
          ),
        )
        .map((model) => {
          const raw = model.name?.replace(/^models\//, '') || '';
          return {
            id: raw,
            label: model.displayName || raw,
          };
        })
        .filter((model) => model.id)
        .sort((a, b) => a.id.localeCompare(b.id));

      return this.operationalOrSeed('gemini', models, true);
    } catch (error) {
      this.logger.warn(`Gemini model catalog failed: ${this.safeError(error)}`);
      return {
        configured: true,
        models: this.seedEntries('gemini'),
        source: 'seed',
        error: this.safeError(error),
      };
    }
  }

  private async listVertexModels(): Promise<ProviderModelCatalog> {
    const json = await this.loadVertexCredentialsJson();
    if (!json) {
      return {
        configured: false,
        models: this.seedEntries('vertex'),
        source: 'seed',
        error: 'Identifiants Vertex non configurés',
      };
    }

    try {
      const account = parseVertexServiceAccount(json);
      const projectId = account.project_id;
      const auth = new GoogleAuth({
        credentials: account as never,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      if (!token.token) throw new Error('Impossible d’obtenir un access token Vertex');

      const location = this.configService.get<string>('VERTEX_LOCATION', 'us-central1');
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      if (!response.ok) {
        throw new Error(`Vertex listModels HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        publisherModels?: Array<{ name?: string; displayName?: string }>;
      };
      const models = (body.publisherModels ?? [])
        .map((model) => {
          const raw = model.name?.split('/').pop() || '';
          return { id: raw, label: model.displayName || raw };
        })
        .filter((model) => /gemini/i.test(model.id))
        .sort((a, b) => a.id.localeCompare(b.id));

      return this.operationalOrSeed('vertex', models, true);
    } catch (error) {
      this.logger.warn(`Vertex model catalog failed: ${this.safeError(error)}`);
      return {
        configured: true,
        models: this.seedEntries('vertex'),
        source: 'seed',
        error: this.safeError(error),
      };
    }
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

  private seedEntries(provider: AiProvider): ModelCatalogEntry[] {
    const ids =
      provider === 'openai'
        ? OPENAI_V1_MODELS
        : provider === 'vertex'
          ? VERTEX_V1_MODELS
          : GEMINI_V1_MODELS;
    return ids.map((id) => ({ id, label: id }));
  }

  /**
   * Live catalogs are intersected with the product allowlist. If none of the
   * operational seeds appear in the live list, fall back to seeds.
   */
  private operationalOrSeed(
    provider: AiProvider,
    liveModels: ModelCatalogEntry[],
    configured: boolean,
  ): ProviderModelCatalog {
    const seedIds = new Set(this.seedEntries(provider).map((entry) => entry.id));
    const operational = liveModels.filter((model) => seedIds.has(model.id));
    if (operational.length === 0) {
      return {
        configured,
        models: this.seedEntries(provider),
        source: 'seed',
        error: 'Aucun modèle opérationnel dans le catalogue live, seeds utilisés',
      };
    }
    return { configured, models: operational, source: 'live' };
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
