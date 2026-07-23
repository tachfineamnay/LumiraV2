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
  createGeminiDeveloperClient,
  createGeminiDiscoveryClient,
  createVertexAiClient,
  decryptSettingsValue,
  parseVertexServiceAccount,
  resolveVertexLocation,
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
  callable: boolean;

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

const PROBE_TIMEOUT_MS = 20_000;
const CACHE_TTL_SUCCESS_MS = 6 * 60 * 60 * 1000; // 6h
const CACHE_TTL_PERMANENT_ERROR_MS = 60 * 60 * 1000; // 1h
const CACHE_TTL_TEMP_ERROR_MS = 15 * 60 * 1000; // 15m

/**
 * Sanitise les logs et messages d'erreur pour éviter toute fuite de secret.
 */
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

    const [openai, gemini, vertex] = await Promise.all([
      this.discoverAndProbeOpenAi(),
      this.discoverAndProbeGemini(),
      this.discoverAndProbeVertex(),
    ]);

    const payload: AvailableModelsResponse = {
      fetchedAt: new Date().toISOString(),
      openai,
      gemini,
      vertex,
    };

    const shortestTtl = Math.min(
      this.computeCatalogTtl(openai),
      this.computeCatalogTtl(gemini),
      this.computeCatalogTtl(vertex),
    );

    this.cache = { payload, expiresAt: Date.now() + shortestTtl };
    return payload;
  }

  clearCache(): void {
    this.cache = null;
  }

  getVertexLocation(): string {
    return resolveVertexLocation(this.configService);
  }

  // ---------------------------------------------------------------------------
  // ÉTAPE 3 — DÉCOUVERTE & PROBE GEMINI API (Developer API v1beta / Probe v1)
  // ---------------------------------------------------------------------------

  private async discoverAndProbeGemini(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      return {
        configured: false,
        models: this.seedFallbackModels('gemini', 'GEMINI_API_KEY non configurée'),
        source: 'unavailable',
        error: 'GEMINI_API_KEY non configurée',
        detectedCount: 0,
        callableCount: 0,
      };
    }

    try {
      const discoveryClient = createGeminiDiscoveryClient(apiKey);
      const candidates: DiscoveredOperationalModel[] = [];

      const pager = await discoveryClient.models.list();
      for await (const model of pager) {
        const rawName = typeof model.name === 'string' ? model.name : '';
        if (!rawName) continue;

        const id =
          rawName
            .replace(/^models\//, '')
            .split('/')
            .pop() || '';
        if (!id) continue;

        // Filtrage des modèles non textuels / non génératifs
        const actions = (model as { supportedActions?: string[] }).supportedActions ?? [];
        const methods =
          (model as { supportedGenerationMethods?: string[] }).supportedGenerationMethods ?? [];
        const combinedMethods = [...actions, ...methods];

        const canGenerate =
          combinedMethods.length === 0
            ? /gemini/i.test(id)
            : combinedMethods.some((m) => /generateContent/i.test(m));

        if (!canGenerate) continue;
        if (this.isNonGenerativeMediaModel(id)) continue;

        const displayName =
          typeof model.displayName === 'string' && model.displayName ? model.displayName : id;
        const inputTokenLimit =
          typeof model.inputTokenLimit === 'number' ? model.inputTokenLimit : undefined;
        const outputTokenLimit =
          typeof model.outputTokenLimit === 'number' ? model.outputTokenLimit : undefined;
        const description =
          typeof (model as { description?: string }).description === 'string'
            ? (model as { description?: string }).description
            : '';
        const thinking =
          /thinking/i.test(id) ||
          /thinking/i.test(displayName) ||
          /thinking/i.test(description) ||
          Boolean((model as { thinking?: boolean }).thinking);

        candidates.push({
          provider: 'gemini',
          id,
          displayName,
          discovery: 'provider_list',
          detected: true,
          callable: false,
          supportedActions: combinedMethods.length > 0 ? combinedMethods : ['generateContent'],
          inputTokenLimit,
          outputTokenLimit,
          thinking,
        });
      }

      // Concurrence max 2 pour les probes
      const prodClient = createGeminiDeveloperClient(apiKey);
      const probed = await this.runBatchProbes(candidates, 2, async (modelId) => {
        const start = Date.now();
        const res = await withTimeout(
          prodClient.models.generateContent({
            model: modelId,
            contents: 'Réponds uniquement par OK.',
            config: { maxOutputTokens: 8 },
          }),
          PROBE_TIMEOUT_MS,
          'Gemini probe timeout',
        );
        const latencyMs = Date.now() - start;
        const text = typeof res.text === 'string' ? res.text.trim() : '';
        if (!text) throw new Error('Réponse vide reçue du modèle Gemini.');
        return { latencyMs };
      });

      const callableCount = probed.filter((m) => m.callable).length;

      return {
        configured: true,
        models: probed,
        source: 'live',
        fetchedAt: new Date().toISOString(),
        detectedCount: probed.length,
        callableCount,
      };
    } catch (error) {
      const safeErr = sanitizeAiSecretString(
        error instanceof Error ? error.message : String(error),
      );
      this.logger.warn(`Gemini discovery failed: ${safeErr}`);
      return {
        configured: true,
        models: this.seedFallbackModels('gemini', safeErr),
        source: 'error',
        error: safeErr,
        detectedCount: 0,
        callableCount: 0,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // ÉTAPE 4 — DÉCOUVERTE & PROBE OPENAI (models.list + Responses API probe)
  // ---------------------------------------------------------------------------

  private async discoverAndProbeOpenAi(): Promise<ProviderModelCatalog> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      return {
        configured: false,
        models: this.seedFallbackModels('openai', 'OPENAI_API_KEY non configurée'),
        source: 'unavailable',
        error: 'OPENAI_API_KEY non configurée',
        detectedCount: 0,
        callableCount: 0,
      };
    }

    try {
      const openai = new OpenAI({ apiKey, maxRetries: 0 });
      const listed = await openai.models.list();
      const candidates: DiscoveredOperationalModel[] = [];

      for await (const model of listed) {
        const id = model.id;
        if (!id) continue;
        if (this.isNonGenerativeMediaModel(id)) continue;

        candidates.push({
          provider: 'openai',
          id,
          displayName: id,
          discovery: 'provider_list',
          detected: true,
          callable: false,
        });
      }

      const probed = await this.runBatchProbes(candidates, 2, async (modelId) => {
        const start = Date.now();
        let text = '';

        // Tente Responses API
        if (
          typeof (
            openai as unknown as {
              responses?: { create: (...args: unknown[]) => Promise<unknown> };
            }
          ).responses?.create === 'function'
        ) {
          const res = await withTimeout(
            (
              openai as unknown as {
                responses: { create: (...args: unknown[]) => Promise<unknown> };
              }
            ).responses.create({
              model: modelId,
              input: 'Réponds uniquement par OK.',
              max_output_tokens: 8,
              store: false,
            }),
            PROBE_TIMEOUT_MS,
            'OpenAI Responses probe timeout',
          );
          text = extractOpenAiTextOutput(res);
        } else {
          // Fallback Chat Completions si Responses n'est pas directement exposé dans cette version SDK
          const res = await withTimeout(
            openai.chat.completions.create({
              model: modelId,
              messages: [{ role: 'user', content: 'Réponds uniquement par OK.' }],
              max_tokens: 8,
            }),
            PROBE_TIMEOUT_MS,
            'OpenAI ChatCompletions probe timeout',
          );
          text = res.choices[0]?.message?.content?.trim() ?? '';
        }

        const latencyMs = Date.now() - start;
        if (!text) throw new Error('Réponse vide reçue du modèle OpenAI.');
        return { latencyMs };
      });

      const callableCount = probed.filter((m) => m.callable).length;

      return {
        configured: true,
        models: probed,
        source: 'live',
        fetchedAt: new Date().toISOString(),
        detectedCount: probed.length,
        callableCount,
      };
    } catch (error) {
      const safeErr = sanitizeAiSecretString(
        error instanceof Error ? error.message : String(error),
      );
      this.logger.warn(`OpenAI discovery failed: ${safeErr}`);
      return {
        configured: true,
        models: this.seedFallbackModels('openai', safeErr),
        source: 'error',
        error: safeErr,
        detectedCount: 0,
        callableCount: 0,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // ÉTAPE 5 — DÉCOUVERTE & PROBE VERTEX AI (Model Garden / REST + Vertex SDK)
  // ---------------------------------------------------------------------------

  private async discoverAndProbeVertex(): Promise<ProviderModelCatalog> {
    const location = this.getVertexLocation();
    const json = await this.loadVertexCredentialsJson();
    if (!json) {
      return {
        configured: false,
        models: this.seedFallbackModels('vertex', 'Identifiants Vertex non configurés'),
        source: 'unavailable',
        error: 'Identifiants Vertex non configurés',
        location,
        detectedCount: 0,
        callableCount: 0,
      };
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
      const tokenRes = await authClient.getAccessToken();
      const accessToken = tokenRes.token;
      if (!accessToken) {
        throw new Error('Impossible d’obtenir un access token pour le compte de service Vertex.');
      }

      // Interrogation de Model Garden
      const candidates = await this.fetchVertexModelGardenCandidates(
        account.project_id,
        location,
        accessToken,
      );

      // Probe réel avec VertexAdapter / SDK Client
      const vertexClient = createVertexAiClient(account, location);
      const probed = await this.runBatchProbes(candidates, 2, async (modelId) => {
        const start = Date.now();
        const res = await withTimeout(
          vertexClient.models.generateContent({
            model: modelId,
            contents: 'Réponds uniquement par OK.',
            config: { maxOutputTokens: 8 },
          }),
          PROBE_TIMEOUT_MS,
          'Vertex probe timeout',
        );
        const latencyMs = Date.now() - start;
        const text = typeof res.text === 'string' ? res.text.trim() : '';
        if (!text) throw new Error('Réponse vide reçue du modèle Vertex AI.');
        return { latencyMs };
      });

      const callableCount = probed.filter((m) => m.callable).length;

      return {
        configured: true,
        models: probed,
        source: 'live',
        location,
        fetchedAt: new Date().toISOString(),
        detectedCount: probed.length,
        callableCount,
      };
    } catch (error) {
      const safeErr = sanitizeAiSecretString(
        error instanceof Error ? error.message : String(error),
      );
      this.logger.warn(`Vertex discovery failed: ${safeErr}`);
      return {
        configured: true,
        models: this.seedFallbackModels('vertex', safeErr),
        source: 'error',
        location,
        error: safeErr,
        detectedCount: 0,
        callableCount: 0,
      };
    }
  }

  private async fetchVertexModelGardenCandidates(
    projectId: string,
    location: string,
    accessToken: string,
  ): Promise<DiscoveredOperationalModel[]> {
    const candidates: DiscoveredOperationalModel[] = [];
    const seen = new Set<string>();

    // Toujours inclure les modèles Vertex supportés officiellement comme candidats
    for (const seedId of VERTEX_V1_MODELS) {
      seen.add(seedId);
      candidates.push({
        provider: 'vertex',
        id: seedId,
        displayName: `Vertex ${seedId}`,
        location,
        discovery: 'model_garden',
        detected: true,
        callable: false,
      });
    }

    try {
      let pageToken: string | undefined;
      do {
        const url = new URL(`https://${location}-aiplatform.googleapis.com/v1/publishers/*/models`);
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'x-goog-user-project': projectId,
          },
        });

        if (!response.ok) {
          const body = await response.text();
          this.logger.warn(
            `Vertex Model Garden fetch HTTP ${response.status}: ${sanitizeAiSecretString(body)}`,
          );
          break;
        }

        const data = (await response.json()) as {
          publisherModels?: Array<{ name?: string; openSourceCategory?: string }>;
          nextPageToken?: string;
        };

        const models = data.publisherModels ?? [];
        for (const m of models) {
          const name = m.name ?? '';
          if (!name.includes('/models/gemini')) continue;
          const id = name.split('/').pop() || '';
          if (!id || seen.has(id) || this.isNonGenerativeMediaModel(id)) continue;

          seen.add(id);
          candidates.push({
            provider: 'vertex',
            id,
            displayName: `Vertex ${id}`,
            location,
            discovery: 'model_garden',
            detected: true,
            callable: false,
          });
        }

        pageToken = data.nextPageToken;
      } while (pageToken);
    } catch (err) {
      this.logger.warn(
        `Vertex Model Garden REST call warning: ${sanitizeAiSecretString(String(err))}`,
      );
    }

    return candidates;
  }

  // ---------------------------------------------------------------------------
  // ÉTAPE 6 — BATCH PROBES & ERROR CLASSIFICATION
  // ---------------------------------------------------------------------------

  private async runBatchProbes(
    candidates: DiscoveredOperationalModel[],
    concurrency: number,
    probeFn: (modelId: string) => Promise<{ latencyMs: number }>,
  ): Promise<DiscoveredOperationalModel[]> {
    const results: DiscoveredOperationalModel[] = [];
    const queue = [...candidates];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          const { latencyMs } = await probeFn(item.id);
          results.push({
            ...item,
            callable: true,
            testedAt: new Date().toISOString(),
            latencyMs,
          });
        } catch (error) {
          const safeMsg = sanitizeAiSecretString(
            error instanceof Error ? error.message : String(error),
          );
          const category = classifyProbeErrorCategory(safeMsg);
          results.push({
            ...item,
            callable: false,
            testedAt: new Date().toISOString(),
            errorCategory: category,
            error: safeMsg,
          });
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () =>
      worker(),
    );
    await Promise.all(workers);

    // Conserver l'ordre initial des candidats
    const orderMap = new Map(candidates.map((c, i) => [c.id, i]));
    return results.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  }

  private isNonGenerativeMediaModel(id: string): boolean {
    const lower = id.toLowerCase();
    return (
      /embedding|imagen|veo|tts|whisper|dall-e|moderation|transcribe|realtime|audio-only|babbage|davinci|search/i.test(
        lower,
      ) &&
      !/gemini/i.test(lower) &&
      !/gpt/i.test(lower)
    );
  }

  private seedFallbackModels(provider: AiProvider, errorMsg: string): DiscoveredOperationalModel[] {
    const seeds =
      provider === 'openai'
        ? OPENAI_V1_MODELS
        : provider === 'vertex'
          ? VERTEX_V1_MODELS
          : GEMINI_V1_MODELS;
    return seeds.map((id) => ({
      provider,
      id,
      displayName: id,
      discovery: (provider === 'vertex' ? 'model_garden' : 'provider_list') as
        | 'provider_list'
        | 'model_garden',
      detected: false,
      callable: false,
      errorCategory: 'not_verified',
      error: errorMsg,
    }));
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

  private computeCatalogTtl(catalog: ProviderModelCatalog): number {
    if (!catalog.configured) return CACHE_TTL_PERMANENT_ERROR_MS;
    const hasPermanentError = catalog.models.some(
      (m) =>
        m.errorCategory === 'invalid_key' ||
        m.errorCategory === 'forbidden' ||
        m.errorCategory === 'quota_billing' ||
        m.errorCategory === 'model_not_found' ||
        m.errorCategory === 'region_not_supported' ||
        m.errorCategory === 'api_not_enabled',
    );
    if (hasPermanentError) return CACHE_TTL_PERMANENT_ERROR_MS;

    const hasTempError = catalog.models.some(
      (m) => m.errorCategory === 'rate_limit' || m.errorCategory === 'network_timeout',
    );
    if (hasTempError) return CACHE_TTL_TEMP_ERROR_MS;

    return CACHE_TTL_SUCCESS_MS;
  }
}

function classifyProbeErrorCategory(message: string): string {
  const lower = message.toLowerCase();
  if (/invalid.*key|unauthorized|401/i.test(lower)) return 'invalid_key';
  if (/forbidden|permission_denied|403/i.test(lower)) return 'forbidden';
  if (/quota|billing|exceeded|insufficient_quota/i.test(lower)) return 'quota_billing';
  if (/not_found|404|unknown model/i.test(lower)) return 'model_not_found';
  if (/region|location/i.test(lower)) return 'region_not_supported';
  if (/api.*not.*enabled|service_disabled/i.test(lower)) return 'api_not_enabled';
  if (/rate_limit|429|too many requests/i.test(lower)) return 'rate_limit';
  if (/timeout|aborted|network/i.test(lower)) return 'network_timeout';
  return 'probe_failed';
}

function extractOpenAiTextOutput(res: unknown): string {
  if (!res || typeof res !== 'object') return '';
  const obj = res as { output_text?: string; choices?: Array<{ message?: { content?: string } }> };
  if (typeof obj.output_text === 'string') return obj.output_text.trim();
  if (Array.isArray(obj.choices) && obj.choices[0]?.message?.content) {
    return obj.choices[0].message.content.trim();
  }
  return '';
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMsg: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Legacy seed helper kept for historical compatibility */
export function legacySeedModelIds(provider: AiProvider): readonly string[] {
  if (provider === 'openai') return OPENAI_V1_MODELS;
  if (provider === 'vertex') return VERTEX_V1_MODELS;
  return GEMINI_V1_MODELS;
}
