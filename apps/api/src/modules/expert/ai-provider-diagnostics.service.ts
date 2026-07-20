import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';

const MODEL_CONFIG_KEY = 'MODEL_CONFIG';

interface StoredModelConfig {
  providerMode?: 'openai_only' | 'comparison';
  agents?: Record<string, { model?: string }>;
  heavyModel?: string;
  flashModel?: string;
  openaiFlashModel?: string;
  openaiHeavyModel?: string;
  agentProviders?: Record<string, string>;
}
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
    const config = await this.loadModelConfig();
    return config.heavyModel || config.flashModel;
  }

  async getConfiguredOpenAIModel(): Promise<string> {
    const config = await this.loadModelConfig();
    if (config.agents?.SCRIBE?.model) return config.agents.SCRIBE.model;
    return config.openaiFlashModel || config.openaiHeavyModel;
  }

  private async loadModelConfig(): Promise<StoredModelConfig> {
    const defaults: StoredModelConfig = {
      openaiHeavyModel: 'gpt-5.5',
      openaiFlashModel: 'gpt-4o',
      agents: { SCRIBE: { model: 'gpt-5.5' } },
    };

    const active = await this.prisma.promptVersion.findFirst({
      where: { key: MODEL_CONFIG_KEY, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!active?.value) {
      return defaults;
    }

    try {
      const stored = JSON.parse(active.value) as Partial<StoredModelConfig>;
      return { ...defaults, ...stored };
    } catch {
      return defaults;
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
        model: this.openaiCache?.text.model ?? 'pending',
      },
    };
  }

  async getAiHealthSnapshotWithModels(): Promise<AiHealthSnapshot> {
    const [geminiModel, openaiModel, base] = await Promise.all([
      this.getConfiguredGeminiModel(),
      this.getConfiguredOpenAIModel(),
      Promise.resolve(this.getAiHealthSnapshot()),
    ]);

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
      false,
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

    this.logger.log(`Testing Gemini connection with model "${model}"`);

    const textProbe = await this.runGeminiTextProbe(apiKey, model, timeoutMs);
    const multimodalProbe = await this.runGeminiMultimodalProbe(apiKey, model, timeoutMs);

    this.geminiCache = {
      text: textProbe,
      multimodal: multimodalProbe,
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };

    const success = textProbe.status === 'ok';
    const primaryError = textProbe.error ?? multimodalProbe.error;

    return {
      success,
      provider: 'gemini',
      model,
      testedAt,
      text: textProbe.status,
      multimodal: multimodalProbe.status,
      error: success ? multimodalProbe.error : primaryError,
      errorCategory: success ? multimodalProbe.errorCategory : textProbe.errorCategory,
      projectId: success ? 'gemini-api' : undefined,
    };
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

    this.logger.log(`Testing OpenAI connection with model "${model}"`);

    const textProbe = await this.runOpenAITextProbe(apiKey, model, timeoutMs);

    this.openaiCache = {
      text: textProbe,
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };

    return {
      success: textProbe.status === 'ok',
      provider: 'openai',
      model,
      testedAt,
      text: textProbe.status,
      error: textProbe.error,
      errorCategory: textProbe.errorCategory,
      projectId: textProbe.status === 'ok' ? 'openai-api' : undefined,
    };
  }

  /** Test-only helper to reset in-memory cache between specs. */
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
    const textStatus: ProviderProbeStatus = cache?.text.status ?? 'not_tested';
    const multimodalStatus: ProviderProbeStatus | undefined = includeMultimodal
      ? (cache?.multimodal?.status ?? 'not_tested')
      : undefined;

    return {
      envVar,
      configured,
      model: cache?.text.model ?? model,
      lastTestedAt: cache?.text.testedAt,
      lastError: cache?.text.error ?? cache?.multimodal?.error,
      text: textStatus,
      multimodal: multimodalStatus,
      state: this.resolveCredentialState(configured, textStatus, cache?.text.errorCategory),
    };
  }

  private resolveCredentialState(
    configured: boolean,
    textStatus: ProviderProbeStatus,
    errorCategory?: string,
  ): ProviderCredentialState {
    if (!configured) {
      return 'not_configured';
    }
    if (textStatus === 'not_tested') {
      return 'not_tested';
    }
    if (textStatus === 'ok') {
      return 'connection_ok';
    }
    if (errorCategory === 'quota') {
      return 'quota_billing';
    }
    if (errorCategory === 'model_not_found') {
      return 'model_inaccessible';
    }
    return 'test_failed';
  }

  private buildResultFromCache(
    provider: 'gemini' | 'openai',
    model: string,
    cache: CachedProviderProbes,
  ): ProviderConnectionTestResult {
    const success = cache.text.status === 'ok';
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

    if (provider === 'gemini') {
      this.geminiCache = {
        text: probe,
        multimodal: { ...probe, status: 'not_tested' },
        expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
      };
    } else {
      this.openaiCache = {
        text: probe,
        expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
      };
    }

    return {
      success: false,
      provider,
      model,
      testedAt,
      text: 'error',
      multimodal: provider === 'gemini' ? 'not_tested' : undefined,
      error: error.userMessage,
      errorCategory: error.category,
    };
  }

  private async runGeminiTextProbe(
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const generativeModel = genAI.getGenerativeModel({ model });
      const result = await withTimeout(
        generativeModel.generateContent({
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
      const generativeModel = genAI.getGenerativeModel({ model });
      const result = await withTimeout(
        generativeModel.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Describe this image in one word.' },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: MINIMAL_PNG_BASE64,
                  },
                },
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
      const classified = this.probeFromError(model, testedAt, error, 'Gemini multimodal probe');
      if (classified.errorCategory === 'model_not_found') {
        return {
          status: 'not_tested',
          model,
          testedAt,
          error: 'Multimodal non testé : le modèle configuré ne supporte peut-être pas les images.',
        };
      }
      return classified;
    }
  }

  private async runOpenAITextProbe(
    apiKey: string,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const client = new OpenAI({ apiKey, timeout: timeoutMs });
      const response = await withTimeout(
        client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 8,
        }),
        timeoutMs,
        'OpenAI text probe',
      );

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Réponse vide de l’API OpenAI');
      }

      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'OpenAI text probe');
    }
  }

  private probeFromError(
    model: string,
    testedAt: string,
    error: unknown,
    context: string,
  ): ProviderProbeResult {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const classified = classifyAiError(rawMessage);
    this.logger.error(`${context} failed: ${sanitizeAiErrorMessage(rawMessage)}`);
    return {
      status: 'error',
      model,
      testedAt,
      error: classified.userMessage,
      errorCategory: classified.category,
    };
  }
}
