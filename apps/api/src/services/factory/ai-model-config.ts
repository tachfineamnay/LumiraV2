import {
  AgentType,
  AiAgentModelConfig,
  AiModelConfigSnapshot,
  AiProvider,
  AiProviderMode,
} from './ai-execution.types';

export const OPENAI_V1_MODELS = [
  'gpt-5.5-2026-04-23',
  'gpt-5.4-2026-03-05',
  'gpt-4o-2024-11-20',
] as const;
export type OpenAiV1Model = (typeof OPENAI_V1_MODELS)[number];

export const VERTEX_V1_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'] as const;
export type VertexV1Model = (typeof VERTEX_V1_MODELS)[number];

export const GEMINI_V1_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'] as const;
export type GeminiV1Model = (typeof GEMINI_V1_MODELS)[number];

export const OPENAI_MODEL_PRICING_USD_PER_MILLION: Record<string, [number, number]> = {
  'gpt-5.5': [5, 30],
  'gpt-5.5-2026-04-23': [5, 30],
  'gpt-5.4': [2.5, 15],
  'gpt-5.4-2026-03-05': [2.5, 15],
  'gpt-4o': [2.5, 10],
  'gpt-4o-2024-11-20': [2.5, 10],
};

export const DEFAULT_AI_MODEL_CONFIG: AiModelConfigSnapshot = {
  providerMode: 'openai_only',
  agents: {
    SCRIBE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.5-2026-04-23',
      reasoningEffort: 'high',
      verbosity: 'high',
      maxOutputTokens: 24000,
    },
    EDITOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      reasoningEffort: 'medium',
      verbosity: 'high',
      maxOutputTokens: 16000,
    },
    GUIDE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      reasoningEffort: 'low',
      verbosity: 'medium',
      maxOutputTokens: 6000,
    },
    NARRATOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 12000,
    },
    CONFIDANT: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 1600,
    },
    ONIRIQUE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      temperature: 0.65,
      topP: 0.9,
      maxOutputTokens: 2500,
    },
  },
};

const AGENTS: AgentType[] = ['SCRIBE', 'EDITOR', 'GUIDE', 'NARRATOR', 'CONFIDANT', 'ONIRIQUE'];
const REASONING_VALUES = new Set(['low', 'medium', 'high']);
const VERBOSITY_VALUES = new Set(['low', 'medium', 'high']);
const ALLOWED_PROVIDERS = new Set<AiProvider>(['openai', 'vertex', 'gemini']);
const ALLOWED_MODES = new Set<AiProviderMode>(['openai_only', 'per_agent']);
// Seed catalogs kept for UI fallback only — not used as hard allowlists.

const DEFAULT_GOOGLE_KNOBS: Record<
  AgentType,
  { temperature: number; topP: number; maxOutputTokens: number }
> = {
  SCRIBE: { temperature: 0.7, topP: 0.9, maxOutputTokens: 24000 },
  EDITOR: { temperature: 0.4, topP: 0.9, maxOutputTokens: 16000 },
  GUIDE: { temperature: 0.5, topP: 0.9, maxOutputTokens: 6000 },
  NARRATOR: { temperature: 0.3, topP: 0.9, maxOutputTokens: 12000 },
  CONFIDANT: { temperature: 0.6, topP: 0.9, maxOutputTokens: 1600 },
  ONIRIQUE: { temperature: 0.65, topP: 0.9, maxOutputTokens: 2500 },
};

export interface NormalizedAiModelConfig {
  config: AiModelConfigSnapshot;
  issues: string[];
  usedFallback: boolean;
}

export function modelsForProvider(provider: AiProvider): readonly string[] {
  if (provider === 'openai') return OPENAI_V1_MODELS;
  if (provider === 'vertex') return VERTEX_V1_MODELS;
  return GEMINI_V1_MODELS;
}

function cloneDefaultAgent(agent: AgentType): AiAgentModelConfig {
  return { ...DEFAULT_AI_MODEL_CONFIG.agents[agent] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isAllowedModel(provider: AiProvider, model: string): boolean {
  // Soft validation: Desk is source of truth. Any non-empty model id is accepted.
  // Seed lists remain available as UI fallbacks when live catalogs fail.
  void provider;
  return typeof model === 'string' && model.trim().length > 0;
}

function normalizeAgent(
  agent: AgentType,
  value: unknown,
  issues: string[],
  providerMode: AiProviderMode,
): AiAgentModelConfig {
  const fallback = cloneDefaultAgent(agent);
  if (!isRecord(value)) {
    issues.push(`${agent}: configuration absente ou invalide, valeur V1 restaurée`);
    return fallback;
  }

  const requestedProvider =
    typeof value.provider === 'string' && ALLOWED_PROVIDERS.has(value.provider as AiProvider)
      ? (value.provider as AiProvider)
      : null;

  if (!requestedProvider) {
    issues.push(`${agent}: provider non autorisé, OpenAI restauré`);
  }

  let provider: AiProvider = requestedProvider ?? 'openai';
  if (providerMode === 'openai_only') {
    provider = 'openai';
    if (requestedProvider && requestedProvider !== 'openai') {
      issues.push(`${agent}: provider ignoré en openai_only, OpenAI forcé`);
    }
  }

  const requestedModel = typeof value.model === 'string' ? value.model.trim() : '';
  let model = requestedModel;
  if (!isAllowedModel(provider, model)) {
    model = provider === 'openai' ? fallback.model : modelsForProvider(provider)[0];
    issues.push(`${agent}: modèle absent ou invalide, ${model} restauré`);
  }

  const enabled = typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled;
  if (typeof value.enabled !== 'boolean') {
    issues.push(`${agent}: état enabled invalide, ${String(fallback.enabled)} restauré`);
  }

  const maxOutputTokens = finiteNumber(value.maxOutputTokens);
  const defaultMax =
    provider === 'openai' ? fallback.maxOutputTokens : DEFAULT_GOOGLE_KNOBS[agent].maxOutputTokens;
  const normalizedMaxTokens =
    maxOutputTokens !== undefined &&
    Number.isInteger(maxOutputTokens) &&
    maxOutputTokens >= 1 &&
    maxOutputTokens <= 100000
      ? maxOutputTokens
      : defaultMax;
  if (normalizedMaxTokens !== maxOutputTokens) {
    issues.push(`${agent}: maxOutputTokens invalide, ${defaultMax} restauré`);
  }

  const result: AiAgentModelConfig = {
    enabled,
    provider,
    model,
    maxOutputTokens: normalizedMaxTokens,
  };

  if (provider === 'openai' && model.startsWith('gpt-5.')) {
    const reasoningValid =
      typeof value.reasoningEffort === 'string' && REASONING_VALUES.has(value.reasoningEffort);
    const verbosityValid =
      typeof value.verbosity === 'string' && VERBOSITY_VALUES.has(value.verbosity);
    result.reasoningEffort = reasoningValid
      ? (value.reasoningEffort as 'low' | 'medium' | 'high')
      : (fallback.reasoningEffort ?? 'medium');
    result.verbosity = verbosityValid
      ? (value.verbosity as 'low' | 'medium' | 'high')
      : (fallback.verbosity ?? 'medium');
    if (!reasoningValid) {
      issues.push(`${agent}: reasoningEffort invalide, ${result.reasoningEffort} restauré`);
    }
    if (!verbosityValid) {
      issues.push(`${agent}: verbosity invalide, ${result.verbosity} restauré`);
    }
    return result;
  }

  const temperature = finiteNumber(value.temperature);
  const topP = finiteNumber(value.topP);
  const defaultTemp =
    provider === 'openai' ? (fallback.temperature ?? 0.3) : DEFAULT_GOOGLE_KNOBS[agent].temperature;
  const defaultTopP =
    provider === 'openai' ? (fallback.topP ?? 0.9) : DEFAULT_GOOGLE_KNOBS[agent].topP;
  const temperatureValid = temperature !== undefined && temperature >= 0 && temperature <= 2;
  const topPValid = topP !== undefined && topP >= 0 && topP <= 1;
  result.temperature = temperatureValid ? temperature : defaultTemp;
  result.topP = topPValid ? topP : defaultTopP;
  if (!temperatureValid) {
    issues.push(`${agent}: temperature invalide, ${result.temperature} restaurée`);
  }
  if (!topPValid) {
    issues.push(`${agent}: topP invalide, ${result.topP} restauré`);
  }
  return result;
}

export function normalizeAiModelConfig(input: unknown): NormalizedAiModelConfig {
  const issues: string[] = [];
  const root = isRecord(input) ? input : {};
  const storedAgents = isRecord(root.agents) ? root.agents : {};

  let providerMode: AiProviderMode = 'openai_only';
  if (
    typeof root.providerMode === 'string' &&
    ALLOWED_MODES.has(root.providerMode as AiProviderMode)
  ) {
    providerMode = root.providerMode as AiProviderMode;
  } else {
    issues.push('providerMode absent ou non autorisé, openai_only restauré');
  }

  const agents = Object.fromEntries(
    AGENTS.map((agent) => [
      agent,
      normalizeAgent(agent, storedAgents[agent], issues, providerMode),
    ]),
  ) as Record<AgentType, AiAgentModelConfig>;

  if (providerMode === 'openai_only') {
    for (const agent of AGENTS) {
      if (agents[agent].provider !== 'openai') {
        agents[agent] = {
          ...cloneDefaultAgent(agent),
          enabled: agents[agent].enabled,
        };
      }
    }
  }

  return {
    config: { providerMode, agents },
    issues,
    usedFallback: issues.length > 0 || !isRecord(input),
  };
}

export function validateAiModelConfig(input: unknown): AiModelConfigSnapshot {
  const normalized = normalizeAiModelConfig(input);
  if (normalized.issues.length > 0) {
    throw new Error(normalized.issues.join('; '));
  }
  return normalized.config;
}

export function estimateOpenAiCost(
  model: string,
  inputTokens?: number,
  outputTokens?: number,
): number | undefined {
  if (inputTokens == null && outputTokens == null) return undefined;
  const rates = OPENAI_MODEL_PRICING_USD_PER_MILLION[model];
  if (!rates) return undefined;
  return ((inputTokens ?? 0) * rates[0] + (outputTokens ?? 0) * rates[1]) / 1_000_000;
}

export function activeProvidersInConfig(config: AiModelConfigSnapshot): Set<AiProvider> {
  if (config.providerMode === 'openai_only') {
    return new Set<AiProvider>(['openai']);
  }
  const providers = new Set<AiProvider>();
  for (const agent of Object.values(config.agents)) {
    if (agent.enabled) providers.add(agent.provider);
  }
  return providers;
}
