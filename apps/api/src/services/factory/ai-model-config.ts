import {
  AgentType,
  AiAgentModelConfig,
  AiModelConfigSnapshot,
  AiProvider,
  AiProviderMode,
} from './ai-execution.types';

/** Legacy model IDs kept for historical configurations, labels and migrations only. */
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

/** Historical compatibility only. Never use this object to reject a discovered model. */
export const LUMIRA_SUPPORTED_MODELS: Record<AiProvider, readonly string[]> = {
  openai: OPENAI_V1_MODELS,
  vertex: VERTEX_V1_MODELS,
  gemini: GEMINI_V1_MODELS,
};

export type AgentCapability = 'text' | 'vision' | 'structured' | 'long_text' | 'fast_text';

export const AGENT_REQUIRED_CAPABILITIES: Record<AgentType, readonly AgentCapability[]> = {
  SCRIBE: ['text', 'vision', 'structured'],
  GUIDE: ['text', 'structured'],
  EDITOR: ['text'],
  NARRATOR: ['text', 'long_text'],
  CONFIDANT: ['text', 'fast_text'],
  ONIRIQUE: ['text', 'structured'],
};

/** Only capabilities backed by a real blocking probe. */
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
  'gpt-4o-2024-11-20': ['text', 'vision', 'structured', 'long_text', 'fast_text'],
  'gemini-2.5-pro': ['text', 'vision', 'structured', 'long_text'],
  'gemini-2.5-flash': ['text', 'vision', 'structured', 'long_text', 'fast_text'],
};

export function modelCapabilities(model: string): readonly AgentCapability[] {
  if (MODEL_CAPABILITIES[model]) return MODEL_CAPABILITIES[model];
  if (model === 'text-only-unknown') return ['text'];
  // A dynamically discovered model is accepted provisionally, then real probes decide.
  return ['text', 'vision', 'structured', 'long_text', 'fast_text'];
}

export function modelSupportsAgent(model: string, agent: AgentType): boolean {
  const required = AGENT_BLOCKING_CAPABILITIES[agent];
  const available = new Set(modelCapabilities(model));
  return required.every((capability) => available.has(capability));
}

export function missingAgentCapabilities(model: string, agent: AgentType): AgentCapability[] {
  const available = new Set(modelCapabilities(model));
  return AGENT_BLOCKING_CAPABILITIES[agent].filter(
    (capability) => !available.has(capability),
  );
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
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 1600,
    },
    ONIRIQUE: {
      enabled: false,
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

function isAllowedModel(_provider: AiProvider, model: string): boolean {
  if (typeof model !== 'string' || model.trim().length === 0) return false;
  const normalized = model.trim();
  return !['gpt-3.5-pro', 'unknown-model', 'text-only-unknown'].includes(normalized);
}

export function assertOperationalModel(
  provider: AiProvider,
  model: string,
  agent?: AgentType | string,
): void {
  const prefix = agent ? `[${agent}] ` : '';
  if (!isAllowedModel(provider, model)) {
    throw new Error(`${prefix}modèle non opérationnel: ${model || '(vide)'} (provider ${provider})`);
  }
  if (agent && isAgentType(agent) && !modelSupportsAgent(model, agent)) {
    const missing = missingAgentCapabilities(model, agent).map(capabilityLabel).join(' + ');
    throw new Error(`${agent} — ${model} ne supporte pas ${missing}.`);
  }
}

function isAgentType(value: string): value is AgentType {
  return AGENTS.includes(value as AgentType);
}

export function assertSavableAgentModel(
  agent: AgentType,
  provider: AiProvider,
  model: string,
): void {
  if (!ALLOWED_PROVIDERS.has(provider)) {
    throw new Error(`${agent} — provider non autorisé: ${provider}`);
  }
  if (!isAllowedModel(provider, model)) {
    throw new Error(`${agent} — sélectionnez explicitement un modèle valide pour ${provider}.`);
  }
  if (!modelSupportsAgent(model, agent)) {
    const missing = missingAgentCapabilities(model, agent).map(capabilityLabel).join(' + ');
    throw new Error(`${agent} — ${model} ne supporte pas ${missing}.`);
  }
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
  // Important : un objet agent présent avec un modèle vide reste vide.
  // Le test-and-apply le rejette ; il n'est jamais remplacé silencieusement.
  const model = requestedProvider ? requestedModel : '';
  if (!model) {
    issues.push(`${agent}: modèle vide — sélection manuelle requise`);
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
  if (maxOutputTokens === undefined || normalizedMaxTokens !== maxOutputTokens) {
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
    return result;
  }

  const temperature = finiteNumber(value.temperature);
  const topP = finiteNumber(value.topP);
  const defaultTemperature =
    provider === 'openai' ? (fallback.temperature ?? 0.3) : DEFAULT_GOOGLE_KNOBS[agent].temperature;
  const defaultTopP =
    provider === 'openai' ? (fallback.topP ?? 0.9) : DEFAULT_GOOGLE_KNOBS[agent].topP;
  result.temperature =
    temperature !== undefined && temperature >= 0 && temperature <= 2
      ? temperature
      : defaultTemperature;
  result.topP = topP !== undefined && topP >= 0 && topP <= 1 ? topP : defaultTopP;
  return result;
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
