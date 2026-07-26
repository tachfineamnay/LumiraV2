import {
  AgentType,
  AiAgentModelConfig,
  AiModelConfigSnapshot,
  AiProvider,
} from './ai-execution.types';
import {
  AiThinkingLevel,
  AgentCapability,
  getModelRuntimeControls,
  isOperationalThinkingModel,
} from './model-runtime-controls';

export type { AgentCapability };

export const ALLOWED_PROVIDERS: ReadonlySet<AiProvider> = new Set(['openai', 'gemini', 'vertex']);

export const HISTORICAL_OPENAI_MODELS = [
  'gpt-4o-2024-11-20',
  'gpt-4o',
  'gpt-4.1-turbo',
  'gpt-3.5-turbo',
] as const;

export const HISTORICAL_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
] as const;

export const HISTORICAL_VERTEX_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
] as const;

export const OPENAI_V1_MODELS = HISTORICAL_OPENAI_MODELS;
export const GEMINI_V1_MODELS = HISTORICAL_GEMINI_MODELS;
export const VERTEX_V1_MODELS = HISTORICAL_VERTEX_MODELS;

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

export function modelCapabilities(
  model: string,
  provider?: AiProvider,
): readonly AgentCapability[] {
  if (provider) {
    return getModelRuntimeControls(provider, model).capabilities;
  }
  for (const p of ['openai', 'gemini', 'vertex'] as const) {
    const controls = getModelRuntimeControls(p, model);
    if (controls.operational) return controls.capabilities;
  }
  return [];
}

export function modelSupportsAgent(
  model: string,
  agent: AgentType,
  provider?: AiProvider,
): boolean {
  const isOp = provider
    ? isOperationalThinkingModel(provider, model)
    : isOperationalThinkingModel('openai', model) ||
      isOperationalThinkingModel('gemini', model) ||
      isOperationalThinkingModel('vertex', model);
  if (!isOp) return false;
  const required = AGENT_BLOCKING_CAPABILITIES[agent];
  const available = new Set(modelCapabilities(model, provider));
  return required.every((capability) => available.has(capability));
}

export function missingAgentCapabilities(
  model: string,
  agent: AgentType,
  provider?: AiProvider,
): AgentCapability[] {
  const available = new Set(modelCapabilities(model, provider));
  return AGENT_BLOCKING_CAPABILITIES[agent].filter((capability) => !available.has(capability));
}

export function modelsForProvider(provider: AiProvider): readonly string[] {
  return operationalModelsForProvider(provider);
}

export function modelsForAgent(provider: AiProvider, agent: AgentType): readonly string[] {
  return modelsForProvider(provider).filter((model) => modelSupportsAgent(model, agent, provider));
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
      return capability;
  }
}

export const DEFAULT_AI_MODEL_CONFIG: AiModelConfigSnapshot = {
  providerMode: 'per_agent',
  agents: {
    SCRIBE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.5-2026-04-23',
      thinkingLevel: 'high',
      maxOutputTokens: 24000,
    },
    EDITOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'medium',
      maxOutputTokens: 16000,
    },
    GUIDE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'low',
      maxOutputTokens: 6000,
    },
    NARRATOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'low',
      maxOutputTokens: 12000,
    },
    CONFIDANT: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'low',
      maxOutputTokens: 1600,
    },
    ONIRIQUE: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-5.4-2026-03-05',
      thinkingLevel: 'medium',
      maxOutputTokens: 2500,
    },
  },
};

export function cloneDefaultAgent(agent: AgentType): AiAgentModelConfig {
  return { ...DEFAULT_AI_MODEL_CONFIG.agents[agent] };
}

export function cloneAiModelConfig(config: AiModelConfigSnapshot): AiModelConfigSnapshot {
  return {
    providerMode: 'per_agent',
    agents: {
      SCRIBE: {
        ...config.agents.SCRIBE,
        ...(config.agents.SCRIBE.validation
          ? {
              validation: {
                ...config.agents.SCRIBE.validation,
                capabilities: { ...config.agents.SCRIBE.validation.capabilities },
              },
            }
          : {}),
      },
      GUIDE: {
        ...config.agents.GUIDE,
        ...(config.agents.GUIDE.validation
          ? {
              validation: {
                ...config.agents.GUIDE.validation,
                capabilities: { ...config.agents.GUIDE.validation.capabilities },
              },
            }
          : {}),
      },
      EDITOR: {
        ...config.agents.EDITOR,
        ...(config.agents.EDITOR.validation
          ? {
              validation: {
                ...config.agents.EDITOR.validation,
                capabilities: { ...config.agents.EDITOR.validation.capabilities },
              },
            }
          : {}),
      },
      CONFIDANT: {
        ...config.agents.CONFIDANT,
        ...(config.agents.CONFIDANT.validation
          ? {
              validation: {
                ...config.agents.CONFIDANT.validation,
                capabilities: { ...config.agents.CONFIDANT.validation.capabilities },
              },
            }
          : {}),
      },
      ONIRIQUE: {
        ...config.agents.ONIRIQUE,
        ...(config.agents.ONIRIQUE.validation
          ? {
              validation: {
                ...config.agents.ONIRIQUE.validation,
                capabilities: { ...config.agents.ONIRIQUE.validation.capabilities },
              },
            }
          : {}),
      },
      NARRATOR: {
        ...config.agents.NARRATOR,
        ...(config.agents.NARRATOR.validation
          ? {
              validation: {
                ...config.agents.NARRATOR.validation,
                capabilities: { ...config.agents.NARRATOR.validation.capabilities },
              },
            }
          : {}),
      },
    },
  };
}

export function activeProvidersInConfig(config: AiModelConfigSnapshot): Set<AiProvider> {
  const set = new Set<AiProvider>();
  for (const agentConfig of Object.values(config.agents)) {
    if (agentConfig.enabled) {
      set.add(agentConfig.provider);
    }
  }
  return set;
}

export interface ActiveProviderModelPair {
  provider: AiProvider;
  model: string;
  agents: AgentType[];
  needsVision: boolean;
  needsStructured: boolean;
}

export function activeProviderModelPairs(config: AiModelConfigSnapshot): ActiveProviderModelPair[] {
  const map = new Map<string, ActiveProviderModelPair>();

  for (const [agentKey, agentConfig] of Object.entries(config.agents) as Array<
    [AgentType, AiAgentModelConfig]
  >) {
    if (!agentConfig.enabled) continue;
    const provider = agentConfig.provider;
    const model = agentConfig.model;
    const key = `${provider}:${model}`;

    const existing = map.get(key) || {
      provider,
      model,
      agents: [],
      needsVision: false,
      needsStructured: false,
    };

    existing.agents.push(agentKey);
    const caps = AGENT_REQUIRED_CAPABILITIES[agentKey] || [];
    if (caps.includes('vision')) existing.needsVision = true;
    if (caps.includes('structured')) existing.needsStructured = true;
    map.set(key, existing);
  }

  return Array.from(map.values());
}

export interface ExecutableAgentModelCheck {
  agent: AgentType;
  provider: AiProvider;
  model: string;
  thinkingLevel?: AiThinkingLevel;
  maxOutputTokens?: number;
}

export function assertExecutableAgentModel(check: ExecutableAgentModelCheck): void {
  const { agent, provider, model, thinkingLevel, maxOutputTokens } = check;
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

  if (maxOutputTokens !== undefined) {
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
      throw new Error(`${agent} — maxOutputTokens invalide (${maxOutputTokens}).`);
    }
    if (maxOutputTokens > controls.maxOutputTokens) {
      throw new Error(
        `${agent} — maxOutputTokens (${maxOutputTokens}) dépasse la limite de ${controls.maxOutputTokens} pour le modèle ${model}.`,
      );
    }
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
  maxOutputTokens?: number,
): void {
  assertExecutableAgentModel({ agent, provider, model, thinkingLevel, maxOutputTokens });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isThinkingLevel(val: string): val is AiThinkingLevel {
  return ['minimal', 'low', 'medium', 'high', 'xhigh'].includes(val);
}

function finiteNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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
  const modelLimit = controls.operational ? controls.maxOutputTokens : 128000;

  let normalizedMaxTokens: number;
  if (maxOutputTokens !== undefined && Number.isInteger(maxOutputTokens) && maxOutputTokens >= 1) {
    if (maxOutputTokens > modelLimit) {
      issues.push(
        `${agent}: maxOutputTokens (${maxOutputTokens}) dépasse la limite de ${modelLimit} pour ${model || fallback.model}, ajusté à ${modelLimit}`,
      );
      normalizedMaxTokens = modelLimit;
    } else {
      normalizedMaxTokens = maxOutputTokens;
    }
  } else {
    issues.push(`${agent}: maxOutputTokens invalide, ${defaultMax} restauré`);
    normalizedMaxTokens = defaultMax;
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
      typeof rawV.capabilities.structured === 'boolean'
    ) {
      result.validation = {
        provider,
        model,
        checkedAt: typeof rawV.checkedAt === 'string' ? rawV.checkedAt : new Date().toISOString(),
        probeVersion: 1,
        capabilities: {
          text: rawV.capabilities.text,
          vision: rawV.capabilities.vision,
          structured: rawV.capabilities.structured,
        },
      };
      result.needsValidation = false;
    } else {
      result.needsValidation = true;
    }
  } else {
    result.needsValidation = controls.operational;
  }

  return result;
}

export function normalizeAiModelConfig(input: unknown): {
  config: AiModelConfigSnapshot;
  issues: string[];
} {
  const issues: string[] = [];
  const root = isRecord(input) ? input : {};

  const rawAgents = isRecord(root.agents) ? root.agents : {};
  const agentsConfig = {
    SCRIBE: normalizeAgent('SCRIBE', rawAgents.SCRIBE, issues),
    GUIDE: normalizeAgent('GUIDE', rawAgents.GUIDE, issues),
    EDITOR: normalizeAgent('EDITOR', rawAgents.EDITOR, issues),
    NARRATOR: normalizeAgent('NARRATOR', rawAgents.NARRATOR, issues),
    CONFIDANT: normalizeAgent('CONFIDANT', rawAgents.CONFIDANT, issues),
    ONIRIQUE: normalizeAgent('ONIRIQUE', rawAgents.ONIRIQUE, issues),
  };

  return {
    config: {
      providerMode: 'per_agent',
      agents: agentsConfig,
    },
    issues,
  };
}

export function assertOperationalModel(provider: AiProvider, model: string): void {
  const controls = getModelRuntimeControls(provider, model);
  if (!controls.operational) {
    throw new Error(
      `Le modèle ${model} sur ${provider} n'est pas autorisé pour la production Lumira.`,
    );
  }
}

export function validateAiModelConfig(config: AiModelConfigSnapshot): {
  valid: boolean;
  issues: string[];
} {
  const normalized = normalizeAiModelConfig(config);
  return {
    valid: normalized.issues.length === 0,
    issues: normalized.issues,
  };
}

export function estimateOpenAiCost(...args: unknown[]): number {
  void args;
  return 0.02;
}
