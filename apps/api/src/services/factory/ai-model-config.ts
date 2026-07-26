import {
  AgentType,
  AiAgentModelConfig,
  AiModelConfigSnapshot,
  AiProvider,
  AiProviderMode,
  AiThinkingLevel,
} from './ai-execution.types';
import { getModelRuntimeControls, isOperationalThinkingModel } from './model-runtime-controls';

export { isOperationalThinkingModel, supportsThinkingLevel } from './model-runtime-controls';

/** Historical model IDs kept for migration checks, historical runs and doc only. */
export const HISTORICAL_OPENAI_MODELS = [
  'gpt-5.5-2026-04-23',
  'gpt-5.4-2026-03-05',
  'gpt-4o-2024-11-20',
] as const;
export const OPENAI_V1_MODELS = HISTORICAL_OPENAI_MODELS;

export const HISTORICAL_VERTEX_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'] as const;
export const VERTEX_V1_MODELS = HISTORICAL_VERTEX_MODELS;

export const HISTORICAL_GEMINI_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash'] as const;
export const GEMINI_V1_MODELS = HISTORICAL_GEMINI_MODELS;

/** Historical compatibility reference only. */
export const LUMIRA_SUPPORTED_MODELS: Record<AiProvider, readonly string[]> = {
  openai: HISTORICAL_OPENAI_MODELS,
  vertex: HISTORICAL_VERTEX_MODELS,
  gemini: HISTORICAL_GEMINI_MODELS,
};

export const OPERATIONAL_OPENAI_MODELS = ['gpt-5.5-2026-04-23', 'gpt-5.4-2026-03-05'] as const;

export const OPERATIONAL_GOOGLE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro',
  'gemini-3-flash',
  'gemini-3-pro',
] as const;

export function operationalModelsForProvider(provider: AiProvider): readonly string[] {
  if (provider === 'openai') return OPERATIONAL_OPENAI_MODELS;
  return OPERATIONAL_GOOGLE_MODELS;
}

export type AgentCapability = 'text' | 'vision' | 'structured' | 'long_text' | 'fast_text';

export const AGENT_REQUIRED_CAPABILITIES: Record<AgentType, readonly AgentCapability[]> = {
  SCRIBE: ['text', 'vision', 'structured'],
  GUIDE: ['text', 'structured'],
  EDITOR: ['text'],
  NARRATOR: ['text', 'long_text'],
  CONFIDANT: ['text', 'fast_text'],
  ONIRIQUE: ['text', 'structured'],
};

export const AGENT_BLOCKING_CAPABILITIES: Record<AgentType, readonly AgentCapability[]> = {
  SCRIBE: ['text', 'vision', 'structured'],
  GUIDE: ['text', 'structured'],
  EDITOR: ['text'],
  NARRATOR: ['text'],
  CONFIDANT: ['text'],
  ONIRIQUE: ['text', 'structured'],
};

const MODEL_CAPABILITIES: Record<string, readonly AgentCapability[]> = {
  'gpt-5.5-2026-04-23': ['text', 'vision', 'structured', 'long_text'],
  'gpt-5.4-2026-03-05': ['text', 'vision', 'structured', 'long_text'],
  'gemini-3.6-flash': ['text', 'vision', 'structured', 'long_text', 'fast_text'],
  'gemini-3.5-flash': ['text', 'vision', 'structured', 'long_text', 'fast_text'],
  'gemini-3.5-flash-lite': ['text', 'vision', 'structured', 'long_text', 'fast_text'],
  'gemini-3.1-pro': ['text', 'vision', 'structured', 'long_text'],
  'gemini-3-flash': ['text', 'vision', 'structured', 'long_text', 'fast_text'],
  'gemini-3-pro': ['text', 'vision', 'structured', 'long_text'],
};

export function modelCapabilities(model: string): readonly AgentCapability[] {
  if (MODEL_CAPABILITIES[model]) return MODEL_CAPABILITIES[model];
  return ['text'];
}

export function modelSupportsAgent(model: string, agent: AgentType): boolean {
  const isOp =
    isOperationalThinkingModel('openai', model) ||
    isOperationalThinkingModel('gemini', model) ||
    isOperationalThinkingModel('vertex', model);
  if (!isOp) return false;
  const required = AGENT_BLOCKING_CAPABILITIES[agent];
  const available = new Set(modelCapabilities(model));
  return required.every((capability) => available.has(capability));
}

export function missingAgentCapabilities(model: string, agent: AgentType): AgentCapability[] {
  const available = new Set(modelCapabilities(model));
  return AGENT_BLOCKING_CAPABILITIES[agent].filter((capability) => !available.has(capability));
}

export function modelsForProvider(provider: AiProvider): readonly string[] {
  return operationalModelsForProvider(provider);
}

export function modelsForAgent(provider: AiProvider, agent: AgentType): readonly string[] {
  return modelsForProvider(provider).filter((model) => modelSupportsAgent(model, agent));
}

export function capabilityLabel(capability: AgentCapability): string {
  switch (capability) {
    case 'vision':
      return 'vision';
    case 'structured':
      return 'JSON structuré';
    case 'long_text':
      return 'texte long';
    case 'fast_text':
      return 'texte rapide';
    default:
      return 'texte';
  }
}

export interface ActiveProviderModelPair {
  provider: AiProvider;
  model: string;
  agents: AgentType[];
  needsText: boolean;
  needsVision: boolean;
  needsStructured: boolean;
}

export function activeProviderModelPairs(config: AiModelConfigSnapshot): ActiveProviderModelPair[] {
  const pairs = new Map<string, ActiveProviderModelPair>();
  for (const [agent, agentConfig] of Object.entries(config.agents) as Array<
    [AgentType, AiAgentModelConfig]
  >) {
    if (!agentConfig.enabled) continue;
    const key = `${agentConfig.provider}:${agentConfig.model}`;
    const capabilities = AGENT_BLOCKING_CAPABILITIES[agent];
    const existing = pairs.get(key);
    if (existing) {
      existing.agents.push(agent);
      existing.needsText ||= capabilities.includes('text');
      existing.needsVision ||= capabilities.includes('vision');
      existing.needsStructured ||= capabilities.includes('structured');
      continue;
    }
    pairs.set(key, {
      provider: agentConfig.provider,
      model: agentConfig.model,
      agents: [agent],
      needsText: capabilities.includes('text'),
      needsVision: capabilities.includes('vision'),
      needsStructured: capabilities.includes('structured'),
    });
  }
  return [...pairs.values()];
}

export const OPENAI_MODEL_PRICING_USD_PER_MILLION: Record<string, [number, number]> = {
  'gpt-5.5': [5, 30],
  'gpt-5.5-2026-04-23': [5, 30],
  'gpt-5.4': [2.5, 15],
  'gpt-5.4-2026-03-05': [2.5, 15],
  'gpt-4o': [2.5, 10],
  'gpt-4o-2024-11-20': [2.5, 10],
};

export const DEFAULT_AI_MODEL_CONFIG: AiModelConfigSnapshot = {
  providerMode: 'per_agent',
  agents: {
    SCRIBE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.5-2026-04-23',
      thinkingLevel: 'high',
      maxOutputTokens: 24000,
      needsValidation: true,
    },
    EDITOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'medium',
      maxOutputTokens: 16000,
      needsValidation: true,
    },
    GUIDE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'low',
      maxOutputTokens: 6000,
      needsValidation: true,
    },
    NARRATOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'low',
      maxOutputTokens: 12000,
      needsValidation: true,
    },
    CONFIDANT: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'low',
      maxOutputTokens: 1600,
      needsValidation: false,
    },
    ONIRIQUE: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'medium',
      maxOutputTokens: 2500,
      needsValidation: false,
    },
  },
};

const AGENTS: AgentType[] = ['SCRIBE', 'EDITOR', 'GUIDE', 'NARRATOR', 'CONFIDANT', 'ONIRIQUE'];
const THINKING_VALUES = new Set<AiThinkingLevel>(['minimal', 'low', 'medium', 'high', 'xhigh']);
const ALLOWED_PROVIDERS = new Set<AiProvider>(['openai', 'vertex', 'gemini']);

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

function isThinkingLevel(value: unknown): value is AiThinkingLevel {
  return typeof value === 'string' && THINKING_VALUES.has(value as AiThinkingLevel);
}

export function assertOperationalModel(
  provider: AiProvider,
  model: string,
  agent?: AgentType | string,
): void {
  const prefix = agent ? `[${agent}] ` : '';
  if (!isOperationalThinkingModel(provider, model)) {
    throw new Error(
      `${prefix}modèle non opérationnel: ${model || '(vide)'} (provider ${provider})`,
    );
  }
}

export interface AssertExecutableAgentModelParams {
  agent: AgentType;
  provider: AiProvider;
  model: string;
  thinkingLevel?: AiThinkingLevel;
}

export function assertExecutableAgentModel({
  agent,
  provider,
  model,
  thinkingLevel,
}: AssertExecutableAgentModelParams): void {
  if (!ALLOWED_PROVIDERS.has(provider)) {
    throw new Error(`${agent} — provider non autorisé: ${provider}`);
  }

  const controls = getModelRuntimeControls(provider, model);

  if (!controls.operational || controls.thinkingLevels.length === 0) {
    throw new Error(
      `${agent} — ${model || '(vide)'} est interdit. Lumira utilise exclusivement des modèles avec niveau de réflexion explicite.`,
    );
  }

  if (!thinkingLevel) {
    throw new Error(`${agent} — un niveau de réflexion explicite est obligatoire pour ${model}.`);
  }

  if (!controls.thinkingLevels.includes(thinkingLevel)) {
    throw new Error(
      `${agent} — niveau ${thinkingLevel} incompatible avec ${model}. Niveaux autorisés : ${controls.thinkingLevels.join(', ')}.`,
    );
  }
}

export function assertValidatedAgentCapabilities(
  agent: AgentType,
  config: AiAgentModelConfig,
): void {
  if (!config.enabled) return;

  const v = config.validation;
  if (
    !v ||
    typeof v !== 'object' ||
    v.probeVersion !== 1 ||
    v.provider !== config.provider ||
    v.model !== config.model ||
    !v.capabilities ||
    typeof v.capabilities !== 'object'
  ) {
    throw new Error(
      `${agent} — Ce modèle doit être testé et appliqué depuis Paramètres → Modèles avant son utilisation.`,
    );
  }

  if (v.capabilities.text !== true) {
    throw new Error(
      `${agent} — Le modèle ${config.model} n'a pas validé la capacité texte lors des tests.`,
    );
  }

  const required = AGENT_BLOCKING_CAPABILITIES[agent] || [];

  if (required.includes('vision') && v.capabilities.vision !== true) {
    throw new Error(
      `${agent} — Ce modèle n'a pas validé la capacité vision requise pour ${agent}.`,
    );
  }

  if (required.includes('structured') && v.capabilities.structured !== true) {
    throw new Error(
      `${agent} — Ce modèle n'a pas validé la capacité JSON structuré requise pour ${agent}.`,
    );
  }
}

export function assertSavableAgentModel(
  agent: AgentType,
  provider: AiProvider,
  model: string,
  thinkingLevel?: AiThinkingLevel,
): void {
  assertExecutableAgentModel({ agent, provider, model, thinkingLevel });
}

function normalizeAgent(agent: AgentType, value: unknown, issues: string[]): AiAgentModelConfig {
  const fallback = cloneDefaultAgent(agent);
  if (!isRecord(value)) {
    issues.push(`${agent}: configuration absente ou invalide, valeur par défaut restaurée`);
    return fallback;
  }

  const enabled = typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled;
  if (typeof value.enabled !== 'boolean') {
    issues.push(`${agent}: état enabled invalide, ${String(fallback.enabled)} restauré`);
  }

  const requestedProvider =
    typeof value.provider === 'string' && ALLOWED_PROVIDERS.has(value.provider as AiProvider)
      ? (value.provider as AiProvider)
      : null;
  const provider = requestedProvider ?? fallback.provider;
  if (!requestedProvider) {
    issues.push(`${agent}: provider absent ou non autorisé`);
  }

  const requestedModel = typeof value.model === 'string' ? value.model.trim() : '';
  const model = requestedProvider ? requestedModel : '';

  const controls = getModelRuntimeControls(provider, model);

  if (!controls.operational) {
    if (!enabled) {
      issues.push(
        `${agent}: modèle ${model || '(vide)'} non opérationnel, réinitialisé vers ${fallback.model}`,
      );
      return fallback;
    }
    issues.push(
      `${agent}: modèle ${model || '(vide)'} non opérationnel — sélection d'un modèle avec réflexion requise`,
    );
  }

  const maxOutputTokens = finiteNumber(value.maxOutputTokens);
  const defaultMax = fallback.maxOutputTokens;
  const normalizedMaxTokens =
    maxOutputTokens !== undefined &&
    Number.isInteger(maxOutputTokens) &&
    maxOutputTokens >= 1 &&
    maxOutputTokens <= 100000
      ? maxOutputTokens
      : defaultMax;
  if (maxOutputTokens === undefined || normalizedMaxTokens !== maxOutputTokens) {
    issues.push(`${agent}: maxOutputTokens invalide, ${defaultMax} restauré`);
  }

  const result: AiAgentModelConfig = {
    enabled,
    provider,
    model,
    maxOutputTokens: normalizedMaxTokens,
  };

  const rawThinkingLevel =
    value.thinkingLevel ?? (provider === 'openai' ? value.reasoningEffort : undefined);
  const thinkingCandidate =
    typeof rawThinkingLevel === 'string' && isThinkingLevel(rawThinkingLevel)
      ? (rawThinkingLevel as AiThinkingLevel)
      : undefined;

  if (controls.operational && controls.thinkingLevels.length > 0) {
    if (thinkingCandidate && controls.thinkingLevels.includes(thinkingCandidate)) {
      result.thinkingLevel = thinkingCandidate;
    } else {
      if (thinkingCandidate) {
        issues.push(
          `${agent}: niveau de réflexion "${thinkingCandidate}" invalide pour ${model}, niveau par défaut appliqué`,
        );
      } else {
        issues.push(
          `${agent}: niveau de réflexion absent pour ${model}, niveau par défaut appliqué`,
        );
      }
      if (controls.defaultThinkingLevel) {
        result.thinkingLevel = controls.defaultThinkingLevel;
      }
    }
  }

  if (isRecord(value.validation) && controls.operational) {
    const rawV = value.validation;
    if (
      rawV.probeVersion === 1 &&
      rawV.provider === provider &&
      rawV.model === model &&
      isRecord(rawV.capabilities) &&
      typeof rawV.capabilities.text === 'boolean' &&
      typeof rawV.capabilities.vision === 'boolean' &&
      typeof rawV.capabilities.structured === 'boolean' &&
      typeof rawV.checkedAt === 'string'
    ) {
      result.validation = {
        provider,
        model,
        checkedAt: rawV.checkedAt,
        probeVersion: 1,
        capabilities: {
          text: rawV.capabilities.text as boolean,
          vision: rawV.capabilities.vision as boolean,
          structured: rawV.capabilities.structured as boolean,
        },
      };
    }
  }

  if (enabled) {
    try {
      assertValidatedAgentCapabilities(agent, result);
      result.needsValidation = false;
    } catch {
      result.needsValidation = true;
    }
  } else {
    result.needsValidation = false;
  }

  return result;
}

export function cloneAiModelConfig(config: AiModelConfigSnapshot): AiModelConfigSnapshot {
  return {
    providerMode: config.providerMode,
    agents: Object.fromEntries(
      Object.entries(config.agents).map(([agent, value]) => [
        agent,
        {
          ...value,
          validation: value.validation
            ? {
                ...value.validation,
                capabilities: { ...value.validation.capabilities },
              }
            : undefined,
        },
      ]),
    ) as AiModelConfigSnapshot['agents'],
  };
}

export function normalizeAiModelConfig(input: unknown): NormalizedAiModelConfig {
  const issues: string[] = [];
  const root = isRecord(input) ? input : {};
  const storedAgents = isRecord(root.agents) ? root.agents : {};
  const providerMode: AiProviderMode = 'per_agent';
  const agents = Object.fromEntries(
    AGENTS.map((agent) => [agent, normalizeAgent(agent, storedAgents[agent], issues)]),
  ) as Record<AgentType, AiAgentModelConfig>;

  return {
    config: { providerMode, agents },
    issues,
    usedFallback: issues.length > 0 || !isRecord(input),
  };
}

export function validateAiModelConfig(input: unknown): AiModelConfigSnapshot {
  const normalized = normalizeAiModelConfig(input);
  if (normalized.issues.length > 0) throw new Error(normalized.issues.join('; '));
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
  if (config.providerMode === 'openai_only') return new Set<AiProvider>(['openai']);
  const providers = new Set<AiProvider>();
  for (const agent of Object.values(config.agents)) {
    if (agent.enabled) providers.add(agent.provider);
  }
  return providers;
}
