import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeAiModelConfig } from '../../services/factory/ai-model-config';
import {
  AiCredentialsStatusResponse,
  AiErrorCategory,
  AiHealthSnapshot,
  ProviderConnectionTestResult,
  ProviderCredentialState,
  ProviderCredentialStatus,
  ProviderProbeResult,
  ProviderProbeStatus,
} from './ai-provider-diagnostics.types';
import {
  AI_HEALTH_CACHE_TTL_MS,
  classifyAiError,
  DEFAULT_AI_TEST_TIMEOUT_MS,
  MINIMAL_PNG_BASE64,
  sanitizeAiErrorMessage,
  withTimeout,
} from './ai-provider-diagnostics.utils';

const MODEL_CONFIG_KEY = 'MODEL_CONFIG';

interface CachedProviderProbes {
  text: ProviderProbeResult;
  multimodal?: ProviderProbeResult;
  expiresAt: number;
}

@Injectable()
export class AiProviderDiagnosticsService {
  private readonly logger = new Logger(AiProviderDiagnosticsService.name);
  private geminiCache: CachedProviderProbes | null = null;
  private openaiCache: CachedProviderProbes | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isGeminiConfigured(): boolean {
    return this.hasEnvKey('GEMINI_API_KEY');
  }

  isOpenAIConfigured(): boolean {
    return this.hasEnvKey('OPENAI_API_KEY');
  }

  async getConfiguredGeminiModel(): Promise<string> {
    const active = await this.loadStoredModelConfig();
    if (active && typeof active === 'object') {
      const record = active as Record<string, unknown>;
      if (typeof record.heavyModel === 'string') return record.heavyModel;
      if (typeof record.flashModel === 'string') return record.flashModel;
    }
    return 'gemini-2.5-flash';
  }

  async getConfiguredOpenAIModel(): Promise<string> {
    const stored = await this.loadStoredModelConfig();
    return normalizeAiModelConfig(stored).config.agents.SCRIBE.model;
  }

  private async loadStoredModelConfig(): Promise<unknown> {
    const active = await this.prisma.promptVersion.findFirst({
      where: { key: MODEL_CONFIG_KEY, isActive: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    if (!active?.value) return undefined;
    try {
      return JSON.parse(active.value);
    } catch {
      return undefined;
    }
  }

  getAiHealthSnapshot(): AiHealthSnapshot {
    return {
      gemini: {
        configured: this.isGeminiConfigured(),
        text: this.geminiCache?.text.status ?? 'not_tested',
        multimodal: this.geminiCache?.multimodal?.status ?? 'not_tested',
        model: this.geminiCache?.text.model ?? 'pending',
      },
      openai: {
        configured: this.isOpenAIConfigured(),
        text: this.openaiCache?.text.status ?? 'not_tested',
        multimodal: this.openaiCache?.multimodal?.status ?? 'not_tested',
        model: this.openaiCache?.text.model ?? 'pending',
      },
    };
  }

  async getAiHealthSnapshotWithModels(): Promise<AiHealthSnapshot> {
    const [geminiModel, openaiModel] = await Promise.all([
      this.getConfiguredGeminiModel(),
      this.getConfiguredOpenAIModel(),
    ]);
    const base = this.getAiHealthSnapshot();
    return {
      gemini: {
        ...base.gemini,
        model: base.gemini.model === 'pending' ? geminiModel : base.gemini.model,
      },
      openai: {
        ...base.openai,
        model: base.openai.model === 'pending' ? openaiModel : base.openai.model,
      },
    };
  }

  async getCredentialsStatus(): Promise<AiCredentialsStatusResponse> {
    const [geminiModel, openaiModel] = await Promise.all([
      this.getConfiguredGeminiModel(),
      this.getConfiguredOpenAIModel(),
    ]);

    const gemini = this.buildCredentialStatus(
      'GEMINI_API_KEY',
      this.isGeminiConfigured(),
      geminiModel,
      this.geminiCache,
      true,
    );
    const openai = this.buildCredentialStatus(
      'OPENAI_API_KEY',
      this.isOpenAIConfigured(),
      openaiModel,
      this.openaiCache,
      true,
    );

    return {
      gemini,
      openai,
      vertexConfigured: gemini.configured,
      openaiConfigured: openai.configured,
    };
  }

  async testGeminiConnection(options?: {
    force?: boolean;
    timeoutMs?: number;
  }): Promise<ProviderConnectionTestResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = await this.getConfiguredGeminiModel();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_AI_TEST_TIMEOUT_MS;
    const testedAt = new Date().toISOString();

    if (!apiKey) {
      return this.buildFailureResult('gemini', model, testedAt, {
        category: 'missing_key',
        userMessage: "GEMINI_API_KEY non configurée dans les variables d'environnement",
      });
    }
    if (!options?.force && this.isCacheValid(this.geminiCache)) {
      return this.buildResultFromCache('gemini', model, this.geminiCache!);
    }

    const text = await this.runGeminiTextProbe(apiKey, model, timeoutMs);
    const multimodal = await this.runGeminiMultimodalProbe(apiKey, model, timeoutMs);
    this.geminiCache = { text, multimodal, expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS };
    return this.buildResultFromCache('gemini', model, this.geminiCache);
  }

  async testOpenAIConnection(options?: {
    force?: boolean;
    timeoutMs?: number;
  }): Promise<ProviderConnectionTestResult> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = await this.getConfiguredOpenAIModel();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_AI_TEST_TIMEOUT_MS;
    const testedAt = new Date().toISOString();

    if (!apiKey) {
      return this.buildFailureResult('openai', model, testedAt, {
        category: 'missing_key',
        userMessage: "OPENAI_API_KEY non configurée dans les variables d'environnement",
      });
    }
    if (!options?.force && this.isCacheValid(this.openaiCache)) {
      return this.buildResultFromCache('openai', model, this.openaiCache!);
    }

    this.logger.log(`Testing OpenAI Responses text + vision with model "${model}"`);
    const text = await this.runOpenAITextProbe(apiKey, model, timeoutMs);
    const multimodal =
      text.status === 'ok'
        ? await this.runOpenAIMultimodalProbe(apiKey, model, timeoutMs)
        : {
            status: 'not_tested' as const,
            model,
            testedAt,
            error: 'Vision non testée car le test texte a échoué.',
          };

    this.openaiCache = { text, multimodal, expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS };
    return this.buildResultFromCache('openai', model, this.openaiCache);
  }

  clearCacheForTests(): void {
    this.geminiCache = null;
    this.openaiCache = null;
  }

  private hasEnvKey(name: string): boolean {
    const value = this.configService.get<string>(name);
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isCacheValid(cache: CachedProviderProbes | null): cache is CachedProviderProbes {
    return !!cache && cache.expiresAt > Date.now();
  }

  private buildCredentialStatus(
    envVar: string,
    configured: boolean,
    model: string,
    cache: CachedProviderProbes | null,
    includeMultimodal: boolean,
  ): ProviderCredentialStatus {
    const text = cache?.text.status ?? 'not_tested';
    const multimodal = includeMultimodal
      ? (cache?.multimodal?.status ?? 'not_tested')
      : undefined;
    const error = cache?.text.error ?? cache?.multimodal?.error;
    const errorCategory = cache?.text.errorCategory ?? cache?.multimodal?.errorCategory;
    return {
      envVar,
      configured,
      model: cache?.text.model ?? model,
      lastTestedAt: cache?.text.testedAt ?? cache?.multimodal?.testedAt,
      lastError: error,
      text,
      multimodal,
      state: this.resolveCredentialState(configured, text, multimodal, errorCategory),
    };
  }

  private resolveCredentialState(
    configured: boolean,
    text: ProviderProbeStatus,
    multimodal?: ProviderProbeStatus,
    errorCategory?: string,
  ): ProviderCredentialState {
    if (!configured) return 'not_configured';
    if (text === 'not_tested') return 'not_tested';
    if (text === 'ok' && (!multimodal || multimodal === 'ok')) return 'connection_ok';
    if (errorCategory === 'quota') return 'quota_billing';
    if (errorCategory === 'model_not_found') return 'model_inaccessible';
    return 'test_failed';
  }

  private buildResultFromCache(
    provider: 'gemini' | 'openai',
    model: string,
    cache: CachedProviderProbes,
  ): ProviderConnectionTestResult {
    const success =
      cache.text.status === 'ok' &&
      (!cache.multimodal || cache.multimodal.status === 'ok');
    return {
      success,
      provider,
      model: cache.text.model || model,
      testedAt: cache.text.testedAt ?? new Date().toISOString(),
      text: cache.text.status,
      multimodal: cache.multimodal?.status,
      error: cache.text.error ?? cache.multimodal?.error,
      errorCategory: cache.text.errorCategory ?? cache.multimodal?.errorCategory,
      projectId: success ? `${provider}-api` : undefined,
    };
  }

  private buildFailureResult(
    provider: 'gemini' | 'openai',
    model: string,
    testedAt: string,
    error: { category: AiErrorCategory; userMessage: string },
  ): ProviderConnectionTestResult {
    const probe: ProviderProbeResult = {
      status: 'error',
      model,
      testedAt,
      error: error.userMessage,
      errorCategory: error.category,
    };
    const cache: CachedProviderProbes = {
      text: probe,
      multimodal: { ...probe, status: 'not_tested' },
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };
    if (provider === 'gemini') this.geminiCache = cache;
    else this.openaiCache = cache;
    return this.buildResultFromCache(provider, model, cache);
  }

  private async runGeminiTextProbe(
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await withTimeout(
        genAI.getGenerativeModel({ model }).generateContent({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
        timeoutMs,
        'Gemini text probe',
      );
      result.response.text();
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Gemini text probe');
    }
  }

  private async runGeminiMultimodalProbe(
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await withTimeout(
        genAI.getGenerativeModel({ model }).generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Décris cette image en un mot.' },
                { inlineData: { mimeType: 'image/png', data: MINIMAL_PNG_BASE64 } },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 8 },
        }),
        timeoutMs,
        'Gemini multimodal probe',
      );
      result.response.text();
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Gemini multimodal probe');
    }
  }

  private openAiProbeParameters(model: string): Record<string, unknown> {
    return model.startsWith('gpt-5.')
      ? { reasoning: { effort: 'low' }, text: { verbosity: 'low' } }
      : { temperature: 0, top_p: 1 };
  }

  private healthJsonFormat(model: string): Record<string, unknown> {
    return {
      ...(model.startsWith('gpt-5.') ? { verbosity: 'low' } : {}),
      format: {
        type: 'json_schema',
        name: 'lumira_health_probe',
        strict: true,
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
          additionalProperties: false,
        },
      },
    };
  }

  private async runOpenAITextProbe(
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
      const response = await withTimeout(
        client.responses.create({
          model,
          instructions: 'Retourne uniquement le JSON demandé.',
          input: 'Réponds avec ok=true.',
          store: false,
          max_output_tokens: 64,
          ...this.openAiProbeParameters(model),
          text: this.healthJsonFormat(model),
        } as Parameters<typeof client.responses.create>[0]),
        timeoutMs,
        'OpenAI Responses text probe',
      );
      const parsed = JSON.parse(response.output_text || '{}') as { ok?: boolean };
      if (parsed.ok !== true) throw new Error('Réponse structurée OpenAI invalide');
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'OpenAI Responses text probe');
    }
  }

  private async runOpenAIMultimodalProbe(
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
      const input = [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Observe cette image puis réponds avec ok=true.' },
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${MINIMAL_PNG_BASE64}`,
              detail: 'high',
            },
          ],
        },
      ];
      const response = await withTimeout(
        client.responses.create({
          model,
          instructions: 'Retourne uniquement le JSON demandé après analyse de l image.',
          input: input as unknown as Parameters<typeof client.responses.create>[0]['input'],
          store: false,
          max_output_tokens: 64,
          ...this.openAiProbeParameters(model),
          text: this.healthJsonFormat(model),
        } as Parameters<typeof client.responses.create>[0]),
        timeoutMs,
        'OpenAI Responses multimodal probe',
      );
      const parsed = JSON.parse(response.output_text || '{}') as { ok?: boolean };
      if (parsed.ok !== true) throw new Error('Réponse multimodale OpenAI invalide');
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'OpenAI Responses multimodal probe');
    }
  }

  private probeFromError(
    model: string,
    testedAt: string,
    error: unknown,
    label: string,
  ): ProviderProbeResult {
    const raw = error instanceof Error ? error.message : String(error);
    const classified = classifyAiError(raw);
    this.logger.warn(`${label} failed: ${sanitizeAiErrorMessage(raw)}`);
    return {
      status: 'error',
      model,
      testedAt,
      error: classified.userMessage,
      errorCategory: classified.category,
    };
  }
}
