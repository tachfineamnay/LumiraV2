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
  IDENTIFIABLE_VISION_PROBE_BASE64,
  sanitizeAiErrorMessage,
  withTimeout,
} from './ai-provider-diagnostics.utils';

const MODEL_CONFIG_KEY = 'MODEL_CONFIG';
const TEXT_PROBE_TOKENS = 256;
const VISION_PROBE_TOKENS = 256;
const STRUCTURED_PROBE_TOKENS = 512;

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
    const pair = (await this.loadActivePairs()).find((item) => item.provider === 'gemini');
    return pair?.model ?? GEMINI_V1_MODELS[1] ?? 'gemini-2.5-flash';
  }

  async getConfiguredVertexModel(): Promise<string> {
    const pair = (await this.loadActivePairs()).find((item) => item.provider === 'vertex');
    return pair?.model ?? VERTEX_V1_MODELS[0];
  }

  async getConfiguredOpenAIModel(): Promise<string> {
    const pair = (await this.loadActivePairs()).find((item) => item.provider === 'openai');
    return pair?.model ?? OPENAI_V1_MODELS[0];
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
        model: gemini?.model ?? 'non utilisé',
      },
      openai: {
        configured: this.isOpenAIConfigured(),
        text: openai?.text.status ?? 'not_tested',
        multimodal: openai?.multimodal?.status ?? 'not_tested',
        model: openai?.model ?? 'non utilisé',
      },
      vertex: {
        configured: Boolean(vertex),
        text: vertex?.text.status ?? 'not_tested',
        multimodal: vertex?.multimodal?.status ?? 'not_tested',
        model: vertex?.model ?? 'non utilisé',
      },
    };
  }

  async getAiHealthSnapshotWithModels(): Promise<AiHealthSnapshot> {
    const [pairs, vertexConfigured] = await Promise.all([
      this.loadActivePairs(),
      this.isVertexConfigured(),
    ]);
    const modelFor = (provider: DiagnosticsProvider): string =>
      pairs.find((pair) => pair.provider === provider)?.model ?? 'non utilisé';
    const geminiModel = modelFor('gemini');
    const openaiModel = modelFor('openai');
    const vertexModel = modelFor('vertex');
    const gemini = this.getCachedProbe('gemini', geminiModel);
    const openai = this.getCachedProbe('openai', openaiModel);
    const vertex = this.getCachedProbe('vertex', vertexModel);

    return {
      gemini: {
        configured: this.isGeminiConfigured(),
        text: gemini?.text.status ?? 'not_tested',
        multimodal: gemini?.multimodal?.status ?? 'not_tested',
        model: geminiModel,
      },
      openai: {
        configured: this.isOpenAIConfigured(),
        text: openai?.text.status ?? 'not_tested',
        multimodal: openai?.multimodal?.status ?? 'not_tested',
        model: openaiModel,
      },
      vertex: {
        configured: vertexConfigured,
        text: vertex?.text.status ?? 'not_tested',
        multimodal: vertex?.multimodal?.status ?? 'not_tested',
        model: vertexModel,
      },
    };
  }

  async getCredentialsStatus(): Promise<AiCredentialsStatusResponse> {
    const [pairs, vertexConfigured] = await Promise.all([
      this.loadActivePairs(),
      this.isVertexConfigured(),
    ]);
    const location = this.getVertexLocation();
    const geminiPairs = pairs.filter((pair) => pair.provider === 'gemini');
    const openaiPairs = pairs.filter((pair) => pair.provider === 'openai');
    const vertexPairs = pairs.filter((pair) => pair.provider === 'vertex');

    const gemini = this.buildCredentialStatus({
      provider: 'gemini',
      envVar: 'GEMINI_API_KEY',
      configured: this.isGeminiConfigured(),
      pairs: geminiPairs,
      credentialSource: 'GEMINI_API_KEY (env)',
    });
    const openai = this.buildCredentialStatus({
      provider: 'openai',
      envVar: 'OPENAI_API_KEY',
      configured: this.isOpenAIConfigured(),
      pairs: openaiPairs,
      credentialSource: 'OPENAI_API_KEY (env)',
    });
    const vertex = this.buildCredentialStatus({
      provider: 'vertex',
      envVar: 'VERTEX_CREDENTIALS_JSON',
      configured: vertexConfigured,
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

  async testProviderModelPair(
    provider: DiagnosticsProvider,
    model: string,
    needsVision: boolean,
    needsStructured: boolean,
    timeoutMs = 30_000,
  ): Promise<ModelConnectionTestResult> {
    const location = provider === 'vertex' ? this.getVertexLocation() : undefined;
    const plan = { provider, model, needsVision, needsStructured };
    const configured = await this.isProviderConfigured(provider);
    if (!configured) {
      return this.cacheAndBuildMissingModelResult(
        provider,
        plan,
        new Date().toISOString(),
        this.missingProviderError(provider),
        location,
      );
    }
    return this.testSingleModel(plan, { force: true, timeoutMs, location });
  }

  clearCacheForTests(): void {
    this.probeCache.clear();
  }

  /**
   * MODEL_CONFIG est enregistré juste après des probes réussis. Ne pas effacer ces
   * résultats immédiatement : ils sont la source de vérité du Desk/readiness.
   * Les entrées expirées sont néanmoins purgées.
   */
  clearAllCaches(): void {
    const now = Date.now();
    for (const [key, value] of this.probeCache.entries()) {
      if (value.expiresAt <= now) this.probeCache.delete(key);
    }
  }

  clearProviderCache(provider: DiagnosticsProvider): void {
    for (const key of [...this.probeCache.keys()]) {
      if (key.startsWith(`${provider}:`)) this.probeCache.delete(key);
    }
  }

  getModelProbe(provider: DiagnosticsProvider, model: string): ModelProbeSnapshot | null {
    const cache = this.getCachedProbe(provider, model);
    if (!cache) return null;
    return {
      provider,
      model: cache.model,
      configured: cache.text.errorCategory !== 'missing_key',
      text: cache.text.status,
      multimodal: cache.multimodal?.status ?? 'not_tested',
      structured: cache.structured?.status ?? 'not_tested',
      lastError: this.firstProbeError(cache),
      lastTestedAt: this.lastProbeDate(cache),
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

    // Un fournisseur configuré mais non utilisé ne déclenche aucun appel payant.
    if (plans.length === 0) {
      return {
        success: true,
        provider,
        model: 'non utilisé',
        testedAt,
        text: 'not_tested',
        multimodal: 'not_tested',
        structured: 'not_tested',
        models: [],
      };
    }

    const location = provider === 'vertex' ? this.getVertexLocation() : undefined;
    const configured = await this.isProviderConfigured(provider);
    if (!configured) {
      const error = this.missingProviderError(provider);
      const models = plans.map((plan) =>
        this.cacheAndBuildMissingModelResult(provider, plan, testedAt, error, location),
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

    this.logger.log(
      `Testing ${provider}/${model} vision=${needsVision} structured=${needsStructured}${location ? ` location=${location}` : ''}`,
    );

    const text =
      provider === 'gemini'
        ? await this.runGeminiTextProbe(model, timeoutMs)
        : provider === 'openai'
          ? await this.runOpenAITextProbe(
              this.configService.get<string>('OPENAI_API_KEY')!.trim(),
              model,
              timeoutMs,
            )
          : await this.runVertexTextProbe(model, timeoutMs);

    let multimodal: ProviderProbeResult | undefined;
    let structured: ProviderProbeResult | undefined;

    if (text.status === 'ok') {
      if (needsVision) {
        multimodal =
          provider === 'gemini'
            ? await this.runGeminiMultimodalProbe(model, timeoutMs)
            : provider === 'openai'
              ? await this.runOpenAIMultimodalProbe(
                  this.configService.get<string>('OPENAI_API_KEY')!.trim(),
                  model,
                  timeoutMs,
                )
              : await this.runVertexMultimodalProbe(model, timeoutMs);
      }
      if (needsStructured) {
        structured =
          provider === 'gemini'
            ? await this.runGeminiStructuredProbe(model, timeoutMs)
            : provider === 'openai'
              ? await this.runOpenAIStructuredProbe(
                  this.configService.get<string>('OPENAI_API_KEY')!.trim(),
                  model,
                  timeoutMs,
                )
              : await this.runVertexStructuredProbe(model, timeoutMs);
      }
    } else {
      if (needsVision) multimodal = this.skippedProbe(model, text, 'Vision');
      if (needsStructured) structured = this.skippedProbe(model, text, 'JSON structuré');
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

  private skippedProbe(
    model: string,
    failedText: ProviderProbeResult,
    label: string,
  ): ProviderProbeResult {
    return {
      status: 'not_tested',
      model,
      testedAt: failedText.testedAt,
      error: `${label} non testé car le test texte a échoué.`,
    };
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
      multimodal: plan.needsVision ? this.skippedProbe(plan.model, probe, 'Vision') : undefined,
      structured: plan.needsStructured
        ? this.skippedProbe(plan.model, probe, 'JSON structuré')
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
    const success =
      text === 'ok' &&
      (!needsVision || multimodal === 'ok') &&
      (!needsStructured || structured === 'ok');
    return {
      model: cache.model,
      success,
      text,
      multimodal,
      structured,
      error: this.firstProbeError(cache),
      errorCategory: this.firstProbeErrorCategory(cache),
      testedAt: this.lastProbeDate(cache) ?? new Date().toISOString(),
      needsVision,
      needsStructured,
      location: cache.location,
    };
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
      model: first?.model ?? 'non utilisé',
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
    return (await this.loadActivePairs())
      .filter((pair) => pair.provider === provider)
      .map((pair) => ({
        provider: pair.provider,
        model: pair.model,
        needsVision: pair.needsVision,
        needsStructured: pair.needsStructured,
      }));
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

  private async isProviderConfigured(provider: DiagnosticsProvider): Promise<boolean> {
    if (provider === 'openai') return this.isOpenAIConfigured();
    if (provider === 'gemini') return this.isGeminiConfigured();
    return this.isVertexConfigured();
  }

  private missingProviderError(provider: DiagnosticsProvider): {
    category: AiErrorCategory;
    userMessage: string;
  } {
    if (provider === 'openai') {
      return {
        category: 'missing_key',
        userMessage: "OPENAI_API_KEY non configurée dans les variables d'environnement",
      };
    }
    if (provider === 'gemini') {
      return {
        category: 'missing_key',
        userMessage: "GEMINI_API_KEY non configurée dans les variables d'environnement",
      };
    }
    return {
      category: 'missing_key',
      userMessage: 'Identifiants Vertex non configurés dans le Desk.',
    };
  }

  private getCachedProbe(
    provider: DiagnosticsProvider,
    model: string,
  ): CachedProviderProbes | undefined {
    return this.probeCache.get(this.probeCacheKey(provider, model));
  }

  private findCachedProviderEntry(provider: DiagnosticsProvider): CachedProviderProbes | undefined {
    return [...this.probeCache.values()].find((entry) => entry.provider === provider);
  }

  private isCacheValid(cache: CachedProviderProbes): boolean {
    return cache.expiresAt > Date.now();
  }

  private buildCredentialStatus(input: {
    provider: DiagnosticsProvider;
    envVar: string;
    configured: boolean;
    pairs: ActiveProviderModelPair[];
    credentialSource: string;
    location?: string;
  }): ProviderCredentialStatus {
    if (input.pairs.length === 0) {
      return {
        envVar: input.envVar,
        configured: input.configured,
        model: 'non utilisé',
        text: 'not_tested',
        multimodal: 'not_tested',
        structured: 'not_tested',
        credentialSource: input.credentialSource,
        location: input.location,
        activeModels: [],
        state: input.configured ? 'configured' : 'not_configured',
      };
    }

    const activeModels = [...new Set(input.pairs.map((pair) => pair.model))];
    const modelStates = activeModels.map((model) => {
      const pair = input.pairs.find((item) => item.model === model)!;
      const cache = this.getCachedProbe(input.provider, model);
      const text = cache?.text.status ?? 'not_tested';
      const multimodal = cache?.multimodal?.status ?? 'not_tested';
      const structured = cache?.structured?.status ?? 'not_tested';
      const errorCategory = this.firstProbeErrorCategory(cache);
      return {
        model,
        text,
        multimodal,
        structured,
        error: cache ? this.firstProbeError(cache) : undefined,
        errorCategory,
        lastTestedAt: cache ? this.lastProbeDate(cache) : undefined,
        state: this.resolveCredentialState(
          input.configured,
          text,
          multimodal,
          structured,
          errorCategory,
          pair.needsVision,
          pair.needsStructured,
        ),
      };
    });

    const primary = modelStates[0];
    const failure = modelStates.find((item) =>
      ['test_failed', 'quota_billing', 'model_inaccessible'].includes(item.state),
    );
    return {
      envVar: input.envVar,
      configured: input.configured,
      model: primary.model,
      lastTestedAt: primary.lastTestedAt,
      lastError: failure?.error,
      text: primary.text,
      multimodal: primary.multimodal,
      structured: primary.structured,
      credentialSource: input.credentialSource,
      location: input.location,
      activeModels,
      state: this.aggregateCredentialStates(
        input.configured,
        modelStates.map((item) => item.state),
      ),
    };
  }

  private aggregateCredentialStates(
    configured: boolean,
    states: ProviderCredentialState[],
  ): ProviderCredentialState {
    if (!configured) return 'not_configured';
    const failure = states.find((state) =>
      ['test_failed', 'quota_billing', 'model_inaccessible'].includes(state),
    );
    if (failure) return failure;
    if (states.every((state) => state === 'connection_ok')) return 'connection_ok';
    return 'not_tested';
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
    if (errorCategory === 'quota' || errorCategory === 'quota_billing') return 'quota_billing';
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
      text === 'ok' &&
      (!needsVision || multimodal === 'ok') &&
      (!needsStructured || structured === 'ok')
    ) {
      return 'connection_ok';
    }
    return 'not_tested';
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
      lastError: cache ? this.firstProbeError(cache) : undefined,
      lastTestedAt: cache ? this.lastProbeDate(cache) : undefined,
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
    return this.runGoogleTextProbe('gemini', this.createGeminiAdapter(), model, timeoutMs);
  }

  private async runVertexTextProbe(model: string, timeoutMs: number): Promise<ProviderProbeResult> {
    return this.runGoogleTextProbe('vertex', this.createVertexAdapter(), model, timeoutMs);
  }

  private async runGoogleTextProbe(
    provider: 'gemini' | 'vertex',
    adapter: GeminiAdapter | VertexAdapter,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const result = await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Réponds exactement à la consigne.',
          userContent: 'Réponds uniquement par OK.',
          maxTokens: TEXT_PROBE_TOKENS,
          signal: new AbortController().signal,
          timeoutMs,
        }),
        timeoutMs,
        `${provider} text probe`,
      );
      if (!/\bOK\b/i.test(result.text?.trim() || '')) {
        throw new Error('Réponse texte vide ou inattendue.');
      }
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, `${provider} text probe`, provider);
    }
  }

  private async runGeminiMultimodalProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    return this.runGoogleVisionProbe('gemini', this.createGeminiAdapter(), model, timeoutMs);
  }

  private async runVertexMultimodalProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    return this.runGoogleVisionProbe('vertex', this.createVertexAdapter(), model, timeoutMs);
  }

  private async runGoogleVisionProbe(
    provider: 'gemini' | 'vertex',
    adapter: GeminiAdapter | VertexAdapter,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const result = await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Décris uniquement les éléments visibles.',
          userContent: 'Indique la couleur des deux formes et le nombre visible.',
          images: [{ mimeType: 'image/png', base64: IDENTIFIABLE_VISION_PROBE_BASE64 }],
          maxTokens: VISION_PROBE_TOKENS,
          signal: new AbortController().signal,
          timeoutMs,
        }),
        timeoutMs,
        `${provider} vision probe`,
      );
      this.assertVisionProbeResponse(result.text);
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, `${provider} vision probe`, provider);
    }
  }

  private async runGeminiStructuredProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    return this.runGoogleStructuredProbe('gemini', this.createGeminiAdapter(), model, timeoutMs);
  }

  private async runVertexStructuredProbe(
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    return this.runGoogleStructuredProbe('vertex', this.createVertexAdapter(), model, timeoutMs);
  }

  private async runGoogleStructuredProbe(
    provider: 'gemini' | 'vertex',
    adapter: GeminiAdapter | VertexAdapter,
    model: string,
    timeoutMs: number,
  ): Promise<ProviderProbeResult> {
    const testedAt = new Date().toISOString();
    try {
      const result = await withTimeout(
        adapter.complete({
          model,
          systemPrompt: 'Retourne uniquement le JSON demandé.',
          userContent: 'Réponds avec ok=true.',
          maxTokens: STRUCTURED_PROBE_TOKENS,
          jsonSchema: this.healthJsonSchema(),
          signal: new AbortController().signal,
          timeoutMs,
        }),
        timeoutMs,
        `${provider} structured probe`,
      );
      this.assertStructuredProbeResponse(result.text, provider);
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, `${provider} structured probe`, provider);
    }
  }

  private openAiProbeParameters(model: string): Record<string, unknown> {
    return model.startsWith('gpt-5.')
      ? { reasoning: { effort: 'low' }, text: { verbosity: 'low' } }
      : {};
  }

  private healthJsonSchema() {
    return {
      name: 'lumira_health_probe',
      schema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false,
      },
    };
  }

  private healthJsonFormat(model: string): Record<string, unknown> {
    return {
      ...(model.startsWith('gpt-5.') ? { verbosity: 'low' } : {}),
      format: {
        type: 'json_schema',
        name: 'lumira_health_probe',
        strict: true,
        schema: this.healthJsonSchema().schema,
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
          instructions: 'Réponds exactement à la consigne.',
          input: 'Réponds uniquement par OK.',
          store: false,
          max_output_tokens: TEXT_PROBE_TOKENS,
          ...this.openAiProbeParameters(model),
        } as Parameters<typeof client.responses.create>[0]),
        timeoutMs,
        'OpenAI text probe',
      );
      if (!/\bOK\b/i.test(this.openAiOutputText(response))) {
        throw new Error('Réponse texte OpenAI vide ou inattendue.');
      }
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'OpenAI text probe', 'openai');
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
      const response = await withTimeout(
        client.responses.create({
          model,
          instructions: 'Décris uniquement les éléments visibles.',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: 'Indique la couleur des deux formes et le nombre visible.',
                },
                {
                  type: 'input_image',
                  image_url: `data:image/png;base64,${IDENTIFIABLE_VISION_PROBE_BASE64}`,
                  detail: 'high',
                },
              ],
            },
          ] as unknown as Parameters<typeof client.responses.create>[0]['input'],
          store: false,
          max_output_tokens: VISION_PROBE_TOKENS,
          ...this.openAiProbeParameters(model),
        } as Parameters<typeof client.responses.create>[0]),
        timeoutMs,
        'OpenAI vision probe',
      );
      this.assertVisionProbeResponse(this.openAiOutputText(response));
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'OpenAI vision probe', 'openai');
    }
  }

  private async runOpenAIStructuredProbe(
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
          max_output_tokens: STRUCTURED_PROBE_TOKENS,
          ...this.openAiProbeParameters(model),
          text: this.healthJsonFormat(model),
        } as Parameters<typeof client.responses.create>[0]),
        timeoutMs,
        'OpenAI structured probe',
      );
      this.assertStructuredProbeResponse(this.openAiOutputText(response), 'openai');
      return { status: 'ok', model, testedAt };
    } catch (error) {
      return this.probeFromError(model, testedAt, error, 'OpenAI structured probe', 'openai');
    }
  }

  private openAiOutputText(response: unknown): string {
    const value = response as { output_text?: unknown };
    return typeof value.output_text === 'string' ? value.output_text.trim() : '';
  }

  private assertVisionProbeResponse(text?: string): void {
    const value = text?.toLowerCase() || '';
    const hasRed = /rouge|red/.test(value);
    const hasBlue = /bleu|blue/.test(value);
    const hasNumber = /\b27\b/.test(value);
    if (!hasRed || !hasBlue || !hasNumber) {
      throw new Error('Réponse vision invalide : rouge, bleu et 27 doivent être identifiés.');
    }
  }

  private assertStructuredProbeResponse(text: string | undefined, provider: string): void {
    const parsed = JSON.parse(text?.trim() || '{}') as { ok?: boolean };
    if (parsed.ok !== true) throw new Error(`Réponse structurée ${provider} invalide.`);
  }

  private firstProbeError(cache?: CachedProviderProbes): string | undefined {
    if (!cache) return undefined;
    return [cache.text, cache.multimodal, cache.structured].find(
      (probe) => probe?.status === 'error',
    )?.error;
  }

  private firstProbeErrorCategory(cache?: CachedProviderProbes): AiErrorCategory | undefined {
    if (!cache) return undefined;
    return [cache.text, cache.multimodal, cache.structured].find(
      (probe) => probe?.status === 'error',
    )?.errorCategory;
  }

  private lastProbeDate(cache: CachedProviderProbes): string | undefined {
    return cache.structured?.testedAt ?? cache.multimodal?.testedAt ?? cache.text.testedAt;
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
