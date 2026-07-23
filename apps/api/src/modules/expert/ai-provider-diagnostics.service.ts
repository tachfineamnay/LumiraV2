import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  activeProviderModelPairs,
  ActiveProviderModelPair,
  GEMINI_V1_MODELS,
  normalizeAiModelConfig,
  OPENAI_V1_MODELS,
  VERTEX_V1_MODELS,
} from '../../services/factory/ai-model-config';
import {
  decryptSettingsValue,
  GeminiAdapter,
  resolveVertexLocation,
  VERTEX_CREDENTIALS_KEY,
  VertexAdapter,
} from '../../services/factory/llm';
import {
  AiCredentialsStatusResponse,
  AiErrorCategory,
  AiHealthSnapshot,
  DiagnosticsProvider,
  ModelConnectionTestResult,
  ModelProbeSnapshot,
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
  provider: DiagnosticsProvider;
  model: string;
  text: ProviderProbeResult;
  multimodal?: ProviderProbeResult;
  structured?: ProviderProbeResult;
  location?: string;
  expiresAt: number;
}

interface ModelProbePlan {
  provider: DiagnosticsProvider;
  model: string;
  needsVision: boolean;
  needsStructured: boolean;
}

@Injectable()
export class AiProviderDiagnosticsService {
  private readonly logger = new Logger(AiProviderDiagnosticsService.name);
  private readonly probeCache = new Map<string, CachedProviderProbes>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  probeCacheKey(provider: DiagnosticsProvider, model: string): string {
    return `${provider}:${model}`;
  }

  isGeminiConfigured(): boolean {
    return this.hasEnvKey('GEMINI_API_KEY');
  }

  isOpenAIConfigured(): boolean {
    return this.hasEnvKey('OPENAI_API_KEY');
  }

  async isVertexConfigured(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: VERTEX_CREDENTIALS_KEY },
      select: { value: true },
    });
    return Boolean(setting?.value?.trim());
  }

  getVertexLocation(): string {
    return resolveVertexLocation(this.configService);
  }

  async getConfiguredGeminiModel(): Promise<string> {
    const pairs = (await this.loadActivePairs()).filter((pair) => pair.provider === 'gemini');
    return pairs[0]?.model ?? GEMINI_V1_MODELS[1] ?? 'gemini-2.5-flash';
  }

  async getConfiguredVertexModel(): Promise<string> {
    const pairs = (await this.loadActivePairs()).filter((pair) => pair.provider === 'vertex');
    return pairs[0]?.model ?? VERTEX_V1_MODELS[0];
  }

  async getConfiguredOpenAIModel(): Promise<string> {
    const pairs = (await this.loadActivePairs()).filter((pair) => pair.provider === 'openai');
    return pairs[0]?.model ?? OPENAI_V1_MODELS[0];
  }

  getAiHealthSnapshot(): AiHealthSnapshot {
    const gemini = this.findCachedProviderEntry('gemini');
    const openai = this.findCachedProviderEntry('openai');
    const vertex = this.findCachedProviderEntry('vertex');
    return {
      gemini: {
        configured: this.isGeminiConfigured(),
        text: gemini?.text.status ?? 'not_tested',
        multimodal: gemini?.multimodal?.status ?? 'not_tested',
        model: gemini?.text.model ?? 'pending',
      },
      openai: {
        configured: this.isOpenAIConfigured(),
        text: openai?.text.status ?? 'not_tested',
        multimodal: openai?.multimodal?.status ?? 'not_tested',
        model: openai?.text.model ?? 'pending',
      },
      vertex: {
        configured: false,
        text: vertex?.text.status ?? 'not_tested',
        multimodal: vertex?.multimodal?.status ?? 'not_tested',
        model: vertex?.text.model ?? 'pending',
      },
    };
  }

  async getAiHealthSnapshotWithModels(): Promise<AiHealthSnapshot> {
    const [geminiModel, openaiModel, vertexModel, vertexConfigured] = await Promise.all([
      this.getConfiguredGeminiModel(),
      this.getConfiguredOpenAIModel(),
      this.getConfiguredVertexModel(),
      this.isVertexConfigured(),
    ]);
    const gemini =
      this.getCachedProbe('gemini', geminiModel) ?? this.findCachedProviderEntry('gemini');
    const openai =
      this.getCachedProbe('openai', openaiModel) ?? this.findCachedProviderEntry('openai');
    const vertex =
      this.getCachedProbe('vertex', vertexModel) ?? this.findCachedProviderEntry('vertex');
    return {
      gemini: {
        configured: this.isGeminiConfigured(),
        text: gemini?.text.status ?? 'not_tested',
        multimodal: gemini?.multimodal?.status ?? 'not_tested',
        model: gemini?.text.model ?? geminiModel,
      },
      openai: {
        configured: this.isOpenAIConfigured(),
        text: openai?.text.status ?? 'not_tested',
        multimodal: openai?.multimodal?.status ?? 'not_tested',
        model: openai?.text.model ?? openaiModel,
      },
      vertex: {
        configured: vertexConfigured,
        text: vertex?.text.status ?? 'not_tested',
        multimodal: vertex?.multimodal?.status ?? 'not_tested',
        model: vertex?.text.model ?? vertexModel,
      },
    };
  }

  async getCredentialsStatus(): Promise<AiCredentialsStatusResponse> {
    const [geminiModel, openaiModel, vertexModel, vertexConfigured, pairs] = await Promise.all([
      this.getConfiguredGeminiModel(),
      this.getConfiguredOpenAIModel(),
      this.getConfiguredVertexModel(),
      this.isVertexConfigured(),
      this.loadActivePairs(),
    ]);
    const location = this.getVertexLocation();

    const geminiPairs = pairs.filter((pair) => pair.provider === 'gemini');
    const openaiPairs = pairs.filter((pair) => pair.provider === 'openai');
    const vertexPairs = pairs.filter((pair) => pair.provider === 'vertex');

    const gemini = this.buildCredentialStatus({
      provider: 'gemini',
      envVar: 'GEMINI_API_KEY',
      configured: this.isGeminiConfigured(),
      defaultModel: geminiModel,
      pairs: geminiPairs,
      credentialSource: 'GEMINI_API_KEY (env)',
    });
    const openai = this.buildCredentialStatus({
      provider: 'openai',
      envVar: 'OPENAI_API_KEY',
      configured: this.isOpenAIConfigured(),
      defaultModel: openaiModel,
      pairs: openaiPairs,
      credentialSource: 'OPENAI_API_KEY (env)',
    });
    const vertex = this.buildCredentialStatus({
      provider: 'vertex',
      envVar: 'VERTEX_CREDENTIALS_JSON',
      configured: vertexConfigured,
      defaultModel: vertexModel,
      pairs: vertexPairs,
      credentialSource: 'Compte de service chiffré (Desk)',
      location,
    });

    const modelProbes = pairs.map((pair) =>
      this.snapshotFromPair(
        pair,
        pair.provider === 'gemini'
          ? this.isGeminiConfigured()
          : pair.provider === 'openai'
            ? this.isOpenAIConfigured()
            : vertexConfigured,
        pair.provider === 'vertex' ? location : undefined,
      ),
    );

    return {
      gemini,
      openai,
      vertex,
      modelProbes,
      vertexConfigured: vertex.configured,
      openaiConfigured: openai.configured,
    };
  }

  async testGeminiConnection(options?: {
    force?: boolean;
    timeoutMs?: number;
  }): Promise<ProviderConnectionTestResult> {
    return this.testProviderConnection('gemini', options);
  }

  async testOpenAIConnection(options?: {
    force?: boolean;
    timeoutMs?: number;
  }): Promise<ProviderConnectionTestResult> {
    return this.testProviderConnection('openai', options);
  }

  async testVertexConnection(options?: {
    force?: boolean;
    timeoutMs?: number;
  }): Promise<ProviderConnectionTestResult> {
    return this.testProviderConnection('vertex', options);
  }

  clearCacheForTests(): void {
    this.probeCache.clear();
  }

  clearAllCaches(): void {
    this.probeCache.clear();
  }

  clearProviderCache(provider: DiagnosticsProvider): void {
    for (const key of [...this.probeCache.keys()]) {
      if (key.startsWith(`${provider}:`)) {
        this.probeCache.delete(key);
      }
    }
  }

  getModelProbe(provider: DiagnosticsProvider, model: string): ModelProbeSnapshot | null {
    const cache = this.getCachedProbe(provider, model);
    if (!cache) return null;
    const configured =
      provider === 'gemini'
        ? this.isGeminiConfigured()
        : provider === 'openai'
          ? this.isOpenAIConfigured()
          : cache.text.errorCategory !== 'missing_key';
    return {
      provider,
      model: cache.model,
      configured,
      text: cache.text.status,
      multimodal: cache.multimodal?.status ?? 'not_tested',
      structured: cache.structured?.status ?? 'not_tested',
      lastError: cache.text.error ?? cache.multimodal?.error ?? cache.structured?.error,
      lastTestedAt: cache.text.testedAt ?? cache.multimodal?.testedAt ?? cache.structured?.testedAt,
      location: cache.location,
    };
  }

  private async testProviderConnection(
    provider: DiagnosticsProvider,
    options?: { force?: boolean; timeoutMs?: number },
  ): Promise<ProviderConnectionTestResult> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_AI_TEST_TIMEOUT_MS;
    const testedAt = new Date().toISOString();
    const plans = await this.resolveProbePlans(provider);
    const location = provider === 'vertex' ? this.getVertexLocation() : undefined;

    const configured =
      provider === 'gemini'
        ? this.isGeminiConfigured()
        : provider === 'openai'
          ? this.isOpenAIConfigured()
          : await this.isVertexConfigured();

    if (!configured) {
      const missing =
        provider === 'gemini'
          ? {
              category: 'missing_key' as const,
              userMessage: "GEMINI_API_KEY non configurée dans les variables d'environnement",
            }
          : provider === 'openai'
            ? {
                category: 'missing_key' as const,
                userMessage: "OPENAI_API_KEY non configurée dans les variables d'environnement",
              }
            : {
                category: 'missing_key' as const,
                userMessage: 'Identifiants Vertex non configurés dans le Desk.',
              };
      const models = plans.map((plan) =>
        this.cacheAndBuildMissingModelResult(provider, plan, testedAt, missing, location),
      );
      return this.aggregateConnectionResult(provider, models);
    }

    const models: ModelConnectionTestResult[] = [];
    for (const plan of plans) {
      models.push(await this.testSingleModel(plan, { force: options?.force, timeoutMs, location }));
    }
    return this.aggregateConnectionResult(provider, models);
  }

  private async testSingleModel(
    plan: ModelProbePlan,
    options: { force?: boolean; timeoutMs: number; location?: string },
  ): Promise<ModelConnectionTestResult> {
    const { provider, model, needsVision, needsStructured } = plan;
    const { force, timeoutMs, location } = options;

    if (!force) {
      const cached = this.getCachedProbe(provider, model);
      if (cached && this.isCacheValid(cached)) {
        return this.modelResultFromCache(cached, needsVision, needsStructured);
      }
    }

    if (provider === 'gemini') {
      this.logger.log(
        `Testing Gemini Developer API with model "${model}" auth=api_key vision=${needsVision} structured=${needsStructured}`,
      );
    } else if (provider === 'openai') {
      this.logger.log(
        `Testing OpenAI Responses with model "${model}" vision=${needsVision} structured=${needsStructured}`,
      );
    } else {
      this.logger.log(
        `Testing Vertex AI with model "${model}" auth=service_account location=${location} vision=${needsVision} structured=${needsStructured}`,
      );
    }

    const text =
      provider === 'gemini'
        ? await this.runGeminiTextProbe(model, timeoutMs)
        : provider === 'openai'
          ? await this.runOpenAITextProbe(
              this.configService.get<string>('OPENAI_API_KEY')!,
              model,
              timeoutMs,
            )
          : await this.runVertexTextProbe(model, timeoutMs);

    let multimodal: ProviderProbeResult | undefined;
    let structured: ProviderProbeResult | undefined;

    if (text.status !== 'ok') {
      if (needsVision) {
        multimodal = {
          status: 'not_tested',
          model,
          testedAt: text.testedAt,
          error: 'Vision non testée car le test texte a échoué.',
        };
      }
      if (needsStructured) {
        structured =
          provider === 'openai'
            ? text
            : {
                status: 'not_tested',
                model,
                testedAt: text.testedAt,
                error: 'JSON structuré non testé car le test texte a échoué.',
              };
      } else if (provider === 'openai') {
        structured = text;
      }
    } else {
      if (needsVision) {
        multimodal =
          provider === 'gemini'
            ? await this.runGeminiMultimodalProbe(model, timeoutMs)
            : provider === 'openai'
              ? await this.runOpenAIMultimodalProbe(
                  this.configService.get<string>('OPENAI_API_KEY')!,
                  model,
                  timeoutMs,
                )
              : await this.runVertexMultimodalProbe(model, timeoutMs);
      }

      if (provider === 'openai') {
        // OpenAI text probe is structured JSON — structured mirrors text.
        structured = text;
      } else if (needsStructured) {
        structured =
          provider === 'gemini'
            ? await this.runGeminiStructuredProbe(model, timeoutMs)
            : await this.runVertexStructuredProbe(model, timeoutMs);
      }
    }

    const cache: CachedProviderProbes = {
      provider,
      model,
      text,
      multimodal,
      structured,
      location,
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };
    this.probeCache.set(this.probeCacheKey(provider, model), cache);
    return this.modelResultFromCache(cache, needsVision, needsStructured);
  }

  private cacheAndBuildMissingModelResult(
    provider: DiagnosticsProvider,
    plan: ModelProbePlan,
    testedAt: string,
    error: { category: AiErrorCategory; userMessage: string },
    location?: string,
  ): ModelConnectionTestResult {
    const probe: ProviderProbeResult = {
      status: 'error',
      model: plan.model,
      testedAt,
      error: error.userMessage,
      errorCategory: error.category,
    };
    const cache: CachedProviderProbes = {
      provider,
      model: plan.model,
      text: probe,
      multimodal: plan.needsVision ? { ...probe, status: 'not_tested' } : undefined,
      structured: plan.needsStructured
        ? provider === 'openai'
          ? probe
          : { ...probe, status: 'not_tested' }
        : provider === 'openai'
          ? probe
          : undefined,
      location,
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };
    this.probeCache.set(this.probeCacheKey(provider, plan.model), cache);
    return this.modelResultFromCache(cache, plan.needsVision, plan.needsStructured);
  }

  private modelResultFromCache(
    cache: CachedProviderProbes,
    needsVision: boolean,
    needsStructured: boolean,
  ): ModelConnectionTestResult {
    const text = cache.text.status;
    const multimodal = cache.multimodal?.status;
    const structured = cache.structured?.status;
    const success = this.isModelProbeSuccess({
      text,
      multimodal,
      structured,
      needsVision,
      needsStructured,
    });
    return {
      model: cache.model,
      success,
      text,
      multimodal,
      structured,
      error: cache.text.error ?? cache.multimodal?.error ?? cache.structured?.error,
      errorCategory:
        cache.text.errorCategory ??
        cache.multimodal?.errorCategory ??
        cache.structured?.errorCategory,
      testedAt:
        cache.text.testedAt ??
        cache.multimodal?.testedAt ??
        cache.structured?.testedAt ??
        new Date().toISOString(),
      needsVision,
      needsStructured,
      location: cache.location,
    };
  }

  private isModelProbeSuccess(input: {
    text: ProviderProbeStatus;
    multimodal?: ProviderProbeStatus;
    structured?: ProviderProbeStatus;
    needsVision: boolean;
    needsStructured: boolean;
  }): boolean {
    if (input.text !== 'ok') return false;
    const multimodalTested = input.multimodal === 'ok' || input.multimodal === 'error';
    const structuredTested = input.structured === 'ok' || input.structured === 'error';
    if ((input.needsVision || multimodalTested) && input.multimodal !== 'ok') return false;
    if ((input.needsStructured || structuredTested) && input.structured !== 'ok') return false;
    return true;
  }

  private aggregateConnectionResult(
    provider: DiagnosticsProvider,
    models: ModelConnectionTestResult[],
  ): ProviderConnectionTestResult {
    const first = models[0];
    const success = models.length > 0 && models.every((model) => model.success);
    const failure = models.find((model) => !model.success);
    return {
      success,
      provider,
      model: first?.model ?? 'unknown',
      testedAt: first?.testedAt ?? new Date().toISOString(),
      text: first?.text ?? 'not_tested',
      multimodal: first?.multimodal,
      structured: first?.structured,
      error: failure?.error,
      errorCategory: failure?.errorCategory,
      models,
      projectId: success ? `${provider}-api` : undefined,
    };
  }

  private async resolveProbePlans(provider: DiagnosticsProvider): Promise<ModelProbePlan[]> {
    const pairs = (await this.loadActivePairs()).filter((pair) => pair.provider === provider);
    if (pairs.length > 0) {
      return pairs.map((pair) => ({
        provider: pair.provider,
        model: pair.model,
        needsVision: pair.needsVision,
        needsStructured: pair.needsStructured,
      }));
    }

    const model =
      provider === 'gemini'
        ? await this.getConfiguredGeminiModel()
        : provider === 'openai'
          ? await this.getConfiguredOpenAIModel()
          : await this.getConfiguredVertexModel();

    return [
      {
        provider,
        model,
        needsVision: true,
        needsStructured: true,
      },
    ];
  }

  private async loadActivePairs(): Promise<ActiveProviderModelPair[]> {
    const config = normalizeAiModelConfig(await this.loadStoredModelConfig()).config;
    return activeProviderModelPairs(config);
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

  private hasEnvKey(name: string): boolean {
    const value = this.configService.get<string>(name);
    return typeof value === 'string' && value.trim().length > 0;
  }

  private getCachedProbe(
    provider: DiagnosticsProvider,
    model: string,
  ): CachedProviderProbes | undefined {
    return this.probeCache.get(this.probeCacheKey(provider, model));
  }

  private findCachedProviderEntry(provider: DiagnosticsProvider): CachedProviderProbes | undefined {
    for (const entry of this.probeCache.values()) {
      if (entry.provider === provider) return entry;
    }
    return undefined;
  }

  private isCacheValid(cache: CachedProviderProbes): boolean {
    return cache.expiresAt > Date.now();
  }

  private buildCredentialStatus(input: {
    provider: DiagnosticsProvider;
    envVar: string;
    configured: boolean;
    defaultModel: string;
    pairs: ActiveProviderModelPair[];
    credentialSource: string;
    location?: string;
  }): ProviderCredentialStatus {
    const activeModels =
      input.pairs.length > 0
        ? [...new Set(input.pairs.map((pair) => pair.model))]
        : [input.defaultModel];

    const modelStates = activeModels.map((model) => {
      const pair = input.pairs.find((item) => item.model === model);
      const needsVision = pair?.needsVision ?? true;
      const needsStructured = pair?.needsStructured ?? true;
      const cache = this.getCachedProbe(input.provider, model);
      const text = cache?.text.status ?? 'not_tested';
      const multimodal = cache?.multimodal?.status ?? 'not_tested';
      const structured = cache?.structured?.status ?? 'not_tested';
      const errorCategory =
        cache?.text.errorCategory ??
        cache?.multimodal?.errorCategory ??
        cache?.structured?.errorCategory;
      return {
        model: cache?.text.model ?? model,
        text,
        multimodal,
        structured,
        error: cache?.text.error ?? cache?.multimodal?.error ?? cache?.structured?.error,
        errorCategory,
        lastTestedAt:
          cache?.text.testedAt ?? cache?.multimodal?.testedAt ?? cache?.structured?.testedAt,
        state: this.resolveCredentialState(
          input.configured,
          text,
          multimodal,
          structured,
          errorCategory,
          needsVision,
          needsStructured,
        ),
      };
    });

    const primary = modelStates[0];
    const state = this.aggregateCredentialStates(
      input.configured,
      modelStates.map((item) => item.state),
    );
    const failure = modelStates.find(
      (item) =>
        item.state === 'test_failed' ||
        item.state === 'quota_billing' ||
        item.state === 'model_inaccessible',
    );

    return {
      envVar: input.envVar,
      configured: input.configured,
      model: primary?.model ?? input.defaultModel,
      lastTestedAt: primary?.lastTestedAt,
      lastError: failure?.error ?? primary?.error,
      text: primary?.text ?? 'not_tested',
      multimodal: primary?.multimodal,
      structured: primary?.structured,
      credentialSource: input.credentialSource,
      location: input.location,
      activeModels,
      state,
    };
  }

  private aggregateCredentialStates(
    configured: boolean,
    states: ProviderCredentialState[],
  ): ProviderCredentialState {
    if (!configured) return 'not_configured';
    if (states.length === 0) return 'not_tested';

    const fail = states.find(
      (state) =>
        state === 'test_failed' || state === 'quota_billing' || state === 'model_inaccessible',
    );
    if (fail) return fail;

    if (states.some((state) => state === 'not_tested' || state === 'configured')) {
      return 'not_tested';
    }

    if (states.every((state) => state === 'connection_ok')) {
      return 'connection_ok';
    }

    return 'test_failed';
  }

  private resolveCredentialState(
    configured: boolean,
    text: ProviderProbeStatus,
    multimodal: ProviderProbeStatus | undefined,
    structured: ProviderProbeStatus | undefined,
    errorCategory?: string,
    needsVision = true,
    needsStructured = true,
  ): ProviderCredentialState {
    if (!configured) return 'not_configured';
    if (errorCategory === 'quota' || errorCategory === 'quota_billing') {
      return 'quota_billing';
    }
    if (errorCategory === 'model_not_found' || errorCategory === 'region_not_supported') {
      return 'model_inaccessible';
    }
    if (
      text === 'error' ||
      (needsVision && multimodal === 'error') ||
      (needsStructured && structured === 'error')
    ) {
      return 'test_failed';
    }
    if (
      text === 'not_tested' ||
      (needsVision && (multimodal ?? 'not_tested') === 'not_tested') ||
      (needsStructured && (structured ?? 'not_tested') === 'not_tested')
    ) {
      return 'not_tested';
    }
    if (
      text === 'ok' &&
      (!needsVision || multimodal === 'ok') &&
      (!needsStructured || structured === 'ok')
    ) {
      return 'connection_ok';
    }
    return 'test_failed';
  }

  private snapshotFromPair(
    pair: ActiveProviderModelPair,
    configured: boolean,
    location?: string,
  ): ModelProbeSnapshot {
    const cache = this.getCachedProbe(pair.provider, pair.model);
    return {
      provider: pair.provider,
      model: pair.model,
      configured,
      text: cache?.text.status ?? 'not_tested',
      multimodal: cache?.multimodal?.status ?? 'not_tested',
      structured: cache?.structured?.status ?? 'not_tested',
      lastError: cache?.text.error ?? cache?.multimodal?.error ?? cache?.structured?.error,
      lastTestedAt:
        cache?.text.testedAt ?? cache?.multimodal?.testedAt ?? cache?.structured?.testedAt,
      location: cache?.location ?? location,
    };
  }

  private createGeminiAdapter(): GeminiAdapter {
    return new GeminiAdapter(() => this.configService.get<string>('GEMINI_API_KEY')?.trim());
  }

  private createVertexAdapter(): VertexAdapter {
    return new VertexAdapter(() => this.loadVertexCredentialsJson(), this.getVertexLocation());
  }

  private async runGeminiTextProbe(model: string, timeoutMs: number): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const adapter = this.createGeminiAdapter();
      const controller = new AbortController();
      await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Réponds brièvement.',
          userContent: 'ping',
          maxTokens: 8,
          temperature: 0,
          topP: 1,
          signal: controller.signal,
          timeoutMs,
        }),
        timeoutMs,
        'Gemini text probe',
      );
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Gemini text probe', 'gemini');
    }
  }

  private async runGeminiMultimodalProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const adapter = this.createGeminiAdapter();
      const controller = new AbortController();
      await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Réponds brièvement.',
          userContent: 'Décris cette image en un mot.',
          images: [{ mimeType: 'image/png', base64: MINIMAL_PNG_BASE64 }],
          maxTokens: 8,
          temperature: 0,
          topP: 1,
          signal: controller.signal,
          timeoutMs,
        }),
        timeoutMs,
        'Gemini multimodal probe',
      );
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Gemini multimodal probe', 'gemini');
    }
  }

  private async runGeminiStructuredProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const adapter = this.createGeminiAdapter();
      const controller = new AbortController();
      const result = await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Retourne uniquement le JSON demandé.',
          userContent: 'Réponds avec ok=true.',
          maxTokens: 64,
          temperature: 0,
          topP: 1,
          jsonSchema: {
            name: 'lumira_health_probe',
            schema: {
              type: 'object',
              properties: { ok: { type: 'boolean' } },
              required: ['ok'],
              additionalProperties: false,
            },
          },
          signal: controller.signal,
          timeoutMs,
        }),
        timeoutMs,
        'Gemini structured probe',
      );
      const parsed = JSON.parse(result.text || '{}') as { ok?: boolean };
      if (parsed.ok !== true) throw new Error('Réponse structurée Gemini invalide');
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Gemini structured probe', 'gemini');
    }
  }

  private async runVertexTextProbe(model: string, timeoutMs: number): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const adapter = this.createVertexAdapter();
      const controller = new AbortController();
      await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Réponds brièvement.',
          userContent: 'ping',
          maxTokens: 8,
          temperature: 0,
          topP: 1,
          signal: controller.signal,
          timeoutMs,
        }),
        timeoutMs,
        'Vertex text probe',
      );
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Vertex text probe', 'vertex');
    }
  }

  private async runVertexMultimodalProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const adapter = this.createVertexAdapter();
      const controller = new AbortController();
      await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Réponds brièvement.',
          userContent: 'Décris cette image en un mot.',
          images: [{ mimeType: 'image/png', base64: MINIMAL_PNG_BASE64 }],
          maxTokens: 8,
          temperature: 0,
          topP: 1,
          signal: controller.signal,
          timeoutMs,
        }),
        timeoutMs,
        'Vertex multimodal probe',
      );
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Vertex multimodal probe', 'vertex');
    }
  }

  private async runVertexStructuredProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const adapter = this.createVertexAdapter();
      const controller = new AbortController();
      const result = await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Retourne uniquement le JSON demandé.',
          userContent: 'Réponds avec ok=true.',
          maxTokens: 64,
          temperature: 0,
          topP: 1,
          jsonSchema: {
            name: 'lumira_health_probe',
            schema: {
              type: 'object',
              properties: { ok: { type: 'boolean' } },
              required: ['ok'],
              additionalProperties: false,
            },
          },
          signal: controller.signal,
          timeoutMs,
        }),
        timeoutMs,
        'Vertex structured probe',
      );
      const parsed = JSON.parse(result.text || '{}') as { ok?: boolean };
      if (parsed.ok !== true) throw new Error('Réponse structurée Vertex invalide');
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'Vertex structured probe', 'vertex');
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

  private openAiOutputText(response: unknown): string {
    const value = response as { output_text?: unknown };
    return typeof value.output_text === 'string' ? value.output_text : '';
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
      const parsed = JSON.parse(this.openAiOutputText(response) || '{}') as { ok?: boolean };
      if (parsed.ok !== true) throw new Error('Réponse structurée OpenAI invalide');
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'OpenAI Responses text probe', 'openai');
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
      const parsed = JSON.parse(this.openAiOutputText(response) || '{}') as { ok?: boolean };
      if (parsed.ok !== true) throw new Error('Réponse multimodale OpenAI invalide');
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(
        model,
        testedAt,
        error,
        'OpenAI Responses multimodal probe',
        'openai',
      );
    }
  }

  private probeFromError(
    model: string,
    testedAt: string,
    error: unknown,
    label: string,
    provider: DiagnosticsProvider,
  ): ProviderProbeResult {
    const raw = error instanceof Error ? error.message : String(error);
    const attachedCode =
      typeof (error as { code?: unknown } | null)?.code === 'string'
        ? ((error as { code: string }).code as AiErrorCategory)
        : undefined;
    const classified = classifyAiError(raw, {
      provider,
      model,
      location: provider === 'vertex' ? this.getVertexLocation() : undefined,
    });
    this.logger.warn(`${label} failed: ${sanitizeAiErrorMessage(raw)}`);
    return {
      status: 'error',
      model,
      testedAt,
      error: classified.userMessage,
      errorCategory: attachedCode ?? classified.category,
    };
  }
}
