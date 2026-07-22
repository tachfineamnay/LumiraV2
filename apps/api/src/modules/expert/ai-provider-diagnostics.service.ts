import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GEMINI_V1_MODELS,
  normalizeAiModelConfig,
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
  structured?: ProviderProbeResult;
  expiresAt: number;
}

@Injectable()
export class AiProviderDiagnosticsService {
  private readonly logger = new Logger(AiProviderDiagnosticsService.name);
  private geminiCache: CachedProviderProbes | null = null;
  private openaiCache: CachedProviderProbes | null = null;
  private vertexCache: CachedProviderProbes | null = null;

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
    const config = normalizeAiModelConfig(await this.loadStoredModelConfig()).config;
    const geminiAgent = Object.values(config.agents).find(
      (agent) => agent.enabled && agent.provider === 'gemini',
    );
    return geminiAgent?.model ?? GEMINI_V1_MODELS[1] ?? 'gemini-2.5-flash';
  }

  async getConfiguredVertexModel(): Promise<string> {
    const config = normalizeAiModelConfig(await this.loadStoredModelConfig()).config;
    const vertexAgent = Object.values(config.agents).find(
      (agent) => agent.enabled && agent.provider === 'vertex',
    );
    return vertexAgent?.model ?? VERTEX_V1_MODELS[0];
  }

  async getConfiguredOpenAIModel(): Promise<string> {
    const stored = await this.loadStoredModelConfig();
    const config = normalizeAiModelConfig(stored).config;
    const openaiAgent = Object.values(config.agents).find(
      (agent) => agent.enabled && agent.provider === 'openai',
    );
    return openaiAgent?.model ?? config.agents.SCRIBE.model;
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
      vertex: {
        configured: false,
        text: this.vertexCache?.text.status ?? 'not_tested',
        multimodal: this.vertexCache?.multimodal?.status ?? 'not_tested',
        model: this.vertexCache?.text.model ?? 'pending',
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
      vertex: {
        ...base.vertex,
        configured: vertexConfigured,
        model: base.vertex.model === 'pending' ? vertexModel : base.vertex.model,
      },
    };
  }

  async getCredentialsStatus(): Promise<AiCredentialsStatusResponse> {
    const [geminiModel, openaiModel, vertexModel, vertexConfigured] = await Promise.all([
      this.getConfiguredGeminiModel(),
      this.getConfiguredOpenAIModel(),
      this.getConfiguredVertexModel(),
      this.isVertexConfigured(),
    ]);
    const location = this.getVertexLocation();

    const gemini = this.buildCredentialStatus(
      'GEMINI_API_KEY',
      this.isGeminiConfigured(),
      geminiModel,
      this.geminiCache,
      true,
      'GEMINI_API_KEY (env)',
    );
    const openai = this.buildCredentialStatus(
      'OPENAI_API_KEY',
      this.isOpenAIConfigured(),
      openaiModel,
      this.openaiCache,
      true,
      'OPENAI_API_KEY (env)',
    );
    const vertex = this.buildCredentialStatus(
      'VERTEX_CREDENTIALS_JSON',
      vertexConfigured,
      vertexModel,
      this.vertexCache,
      true,
      'Compte de service chiffré (Desk)',
      location,
    );

    return {
      gemini,
      openai,
      vertex,
      vertexConfigured: vertex.configured,
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

    this.logger.log(
      `Testing Gemini Developer API text + vision with model "${model}" auth=api_key`,
    );
    const text = await this.runGeminiTextProbe(model, timeoutMs);
    const multimodal =
      text.status === 'ok'
        ? await this.runGeminiMultimodalProbe(model, timeoutMs)
        : {
            status: 'not_tested' as const,
            model,
            testedAt,
            error: 'Vision non testée car le test texte a échoué.',
          };
    const structured =
      text.status === 'ok'
        ? await this.runGeminiStructuredProbe(model, timeoutMs)
        : {
            status: 'not_tested' as const,
            model,
            testedAt,
            error: 'JSON structuré non testé car le test texte a échoué.',
          };

    this.geminiCache = {
      text,
      multimodal,
      structured,
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };
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

    this.openaiCache = {
      text,
      multimodal,
      structured: text,
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };
    return this.buildResultFromCache('openai', model, this.openaiCache);
  }

  async testVertexConnection(options?: {
    force?: boolean;
    timeoutMs?: number;
  }): Promise<ProviderConnectionTestResult> {
    const model = await this.getConfiguredVertexModel();
    const timeoutMs = options?.timeoutMs ?? DEFAULT_AI_TEST_TIMEOUT_MS;
    const testedAt = new Date().toISOString();
    const configured = await this.isVertexConfigured();
    const location = this.getVertexLocation();

    if (!configured) {
      return this.buildFailureResult('vertex', model, testedAt, {
        category: 'missing_key',
        userMessage: 'Identifiants Vertex non configurés dans le Desk.',
      });
    }
    if (!options?.force && this.isCacheValid(this.vertexCache)) {
      return this.buildResultFromCache('vertex', model, this.vertexCache!);
    }

    this.logger.log(
      `Testing Vertex AI text + vision with model "${model}" auth=service_account location=${location}`,
    );
    const text = await this.runVertexTextProbe(model, timeoutMs);
    const multimodal =
      text.status === 'ok'
        ? await this.runVertexMultimodalProbe(model, timeoutMs)
        : {
            status: 'not_tested' as const,
            model,
            testedAt,
            error: 'Vision non testée car le test texte a échoué.',
          };
    const structured =
      text.status === 'ok'
        ? await this.runVertexStructuredProbe(model, timeoutMs)
        : {
            status: 'not_tested' as const,
            model,
            testedAt,
            error: 'JSON structuré non testé car le test texte a échoué.',
          };

    this.vertexCache = {
      text,
      multimodal,
      structured,
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };
    return this.buildResultFromCache('vertex', model, this.vertexCache);
  }

  clearCacheForTests(): void {
    this.geminiCache = null;
    this.openaiCache = null;
    this.vertexCache = null;
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
    credentialSource: string,
    location?: string,
  ): ProviderCredentialStatus {
    const text = cache?.text.status ?? 'not_tested';
    const multimodal = includeMultimodal ? (cache?.multimodal?.status ?? 'not_tested') : undefined;
    const structured = cache?.structured?.status ?? 'not_tested';
    const error = cache?.text.error ?? cache?.multimodal?.error ?? cache?.structured?.error;
    const errorCategory =
      cache?.text.errorCategory ??
      cache?.multimodal?.errorCategory ??
      cache?.structured?.errorCategory;
    return {
      envVar,
      configured,
      model: cache?.text.model ?? model,
      lastTestedAt: cache?.text.testedAt ?? cache?.multimodal?.testedAt,
      lastError: error,
      text,
      multimodal,
      structured,
      credentialSource,
      location,
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
    if (errorCategory === 'model_not_found' || errorCategory === 'region_not_supported') {
      return 'model_inaccessible';
    }
    return 'test_failed';
  }

  private buildResultFromCache(
    provider: DiagnosticsProvider,
    model: string,
    cache: CachedProviderProbes,
  ): ProviderConnectionTestResult {
    const success =
      cache.text.status === 'ok' && (!cache.multimodal || cache.multimodal.status === 'ok');
    return {
      success,
      provider,
      model: cache.text.model || model,
      testedAt: cache.text.testedAt ?? new Date().toISOString(),
      text: cache.text.status,
      multimodal: cache.multimodal?.status,
      error: cache.text.error ?? cache.multimodal?.error ?? cache.structured?.error,
      errorCategory:
        cache.text.errorCategory ??
        cache.multimodal?.errorCategory ??
        cache.structured?.errorCategory,
      projectId: success ? `${provider}-api` : undefined,
    };
  }

  private buildFailureResult(
    provider: DiagnosticsProvider,
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
      structured: { ...probe, status: 'not_tested' },
      expiresAt: Date.now() + AI_HEALTH_CACHE_TTL_MS,
    };
    if (provider === 'gemini') this.geminiCache = cache;
    else if (provider === 'openai') this.openaiCache = cache;
    else this.vertexCache = cache;
    return this.buildResultFromCache(provider, model, cache);
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
      errorCategory: classified.category,
    };
  }
}
