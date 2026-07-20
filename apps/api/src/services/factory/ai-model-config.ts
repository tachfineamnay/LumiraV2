import { AgentType, AiAgentModelConfig, AiModelConfigSnapshot } from './ai-execution.types';

export const OPENAI_V1_MODELS = ['gpt-5.5', 'gpt-5.4', 'gpt-4o'] as const;
export type OpenAiV1Model = (typeof OPENAI_V1_MODELS)[number];

export const OPENAI_MODEL_PRICING_USD_PER_MILLION: Record<string, [number, number]> = {
  'gpt-5.5': [5, 30],
  'gpt-5.5-2026-04-23': [5, 30],
  'gpt-5.4': [2.5, 15],
  'gpt-5.4-2026-03-05': [2.5, 15],
  'gpt-4o': [2.5, 10],
};

export const DEFAULT_AI_MODEL_CONFIG: AiModelConfigSnapshot = {
  providerMode: 'openai_only',
  agents: {
    SCRIBE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.5',
      reasoningEffort: 'high',
      verbosity: 'high',
      maxOutputTokens: 24000,
    },
    EDITOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4',
      reasoningEffort: 'medium',
      verbosity: 'high',
      maxOutputTokens: 16000,
    },
    GUIDE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4',
      reasoningEffort: 'low',
      verbosity: 'medium',
      maxOutputTokens: 6000,
    },
    NARRATOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 12000,
    },
    CONFIDANT: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 1600,
    },
    ONIRIQUE: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.65,
      topP: 0.9,
      maxOutputTokens: 2500,
    },
  },
};

const AGENTS: AgentType[] = ['SCRIBE', 'EDITOR', 'GUIDE', 'NARRATOR', 'CONFIDANT', 'ONIRIQUE'];
const REASONING_VALUES = new Set(['low', 'medium', 'high']);
const VERBOSITY_VALUES = new Set(['low', 'medium', 'high']);
const ALLOWED_MODELS = new Set<string>(OPENAI_V1_MODELS);

export interface NormalizedAiModelConfig {
  config: AiModelConfigSnapshot;
  issues: string[];
  usedFallback: boolean;
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

function normalizeAgent(
  agent: AgentType,
  value: unknown,
  issues: string[],
): AiAgentModelConfig {
  const fallback = cloneDefaultAgent(agent);
  if (!isRecord(value)) {
    issues.push(`${agent}: configuration absente ou invalide, valeur V1 restaurée`);
    return fallback;
  }

  if (value.provider !== 'openai') {
    issues.push(`${agent}: provider non autorisé, OpenAI restauré`);
  }

  const model =
    typeof value.model === 'string' && ALLOWED_MODELS.has(value.model)
      ? value.model
      : fallback.model;
  if (model !== value.model) {
    issues.push(`${agent}: modèle non autorisé, ${fallback.model} restauré`);
  }

  const enabled = typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled;
  if (typeof value.enabled !== 'boolean') {
    issues.push(`${agent}: état enabled invalide, ${String(fallback.enabled)} restauré`);
  }

  const maxOutputTokens = finiteNumber(value.maxOutputTokens);
  const normalizedMaxTokens =
    maxOutputTokens !== undefined &&
    Number.isInteger(maxOutputTokens) &&
    maxOutputTokens >= 1 &&
    maxOutputTokens <= 100000
      ? maxOutputTokens
      : fallback.maxOutputTokens;
  if (normalizedMaxTokens !== maxOutputTokens) {
    issues.push(`${agent}: maxOutputTokens invalide, ${fallback.maxOutputTokens} restauré`);
  }

  const result: AiAgentModelConfig = {
    enabled,
    provider: 'openai',
    model,
    maxOutputTokens: normalizedMaxTokens,
  };

  if (model.startsWith('gpt-5.')) {
    const reasoningValid =
      typeof value.reasoningEffort === 'string' && REASONING_VALUES.has(value.reasoningEffort);
    const verbosityValid =
      typeof value.verbosity === 'string' && VERBOSITY_VALUES.has(value.verbosity);
    result.reasoningEffort = reasoningValid
      ? (value.reasoningEffort as 'low' | 'medium' | 'high')
      : fallback.reasoningEffort ?? 'medium';
    result.verbosity = verbosityValid
      ? (value.verbosity as 'low' | 'medium' | 'high')
      : fallback.verbosity ?? 'medium';
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
  const temperatureValid = temperature !== undefined && temperature >= 0 && temperature <= 2;
  const topPValid = topP !== undefined && topP >= 0 && topP <= 1;
  result.temperature = temperatureValid ? temperature : fallback.temperature ?? 0.3;
  result.topP = topPValid ? topP : fallback.topP ?? 0.9;
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

  if (root.providerMode !== 'openai_only') {
    issues.push('providerMode absent ou non autorisé en V1, openai_only restauré');
  }

  const agents = Object.fromEntries(
    AGENTS.map((agent) => [agent, normalizeAgent(agent, storedAgents[agent], issues)]),
  ) as Record<AgentType, AiAgentModelConfig>;

  return {
    config: { providerMode: 'openai_only', agents },
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
  return (((inputTokens ?? 0) * rates[0]) + ((outputTokens ?? 0) * rates[1])) / 1_000_000;
}
