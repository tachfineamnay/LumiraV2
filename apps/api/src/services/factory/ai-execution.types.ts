import { AiMission, ProductLevel } from '@prisma/client';
import { AiThinkingLevel } from './model-runtime-controls';

export type { AiThinkingLevel } from './model-runtime-controls';
export type AgentType = 'SCRIBE' | 'GUIDE' | 'EDITOR' | 'CONFIDANT' | 'ONIRIQUE' | 'NARRATOR';

export interface AiExecutionContext {
  orderId?: string;
  productLevel?: ProductLevel;
  agent: AgentType;
  mission: AiMission;
  locale?: string;
  promptVersionId?: string;
}

export interface AiPromptSnapshot {
  lumiraDna: string;
  agentContexts: Record<AgentType, string>;
  modelConfig: AiModelConfigSnapshot;
}

export type AiProviderMode = 'openai_only' | 'per_agent';
export type AiProvider = 'openai' | 'vertex' | 'gemini';

export interface AiAgentValidationProof {
  provider: AiProvider;
  model: string;
  checkedAt: string;
  probeVersion: 1;
  capabilities: {
    text: boolean;
    vision: boolean;
    structured: boolean;
  };
}

export interface AiAgentModelConfig {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  /** Unified production control for models exposing an explicit thinking level. */
  thinkingLevel?: AiThinkingLevel;
  maxOutputTokens: number;
  /** Proof of real provider probe results performed via Desk Settings. */
  validation?: AiAgentValidationProof;
  /** Flag indicating configuration needs revalidation via Desk Settings. */
  needsValidation?: boolean;
}

export interface AiModelConfigSnapshot {
  providerMode: AiProviderMode;
  agents: Record<AgentType, AiAgentModelConfig>;
}

export interface ResolvedAiExecution {
  provider: AiProvider;
  model: string;
  thinkingLevel?: AiThinkingLevel;
  maxTokens: number;
  systemPrompt: string;
  promptVersionId?: string;
  routingSource: string;
}

export type AiRunStatus = 'SUCCESS' | 'ERROR';

export interface AiRunRecordInput {
  orderId?: string;
  agent: AgentType;
  mission: AiMission;
  productLevel?: ProductLevel;
  provider: string;
  model: string;
  promptVersionId?: string;
  routingSource?: string;
}

export const AGENT_PROMPT_KEYS: Record<AgentType, string> = {
  SCRIBE: 'SCRIBE',
  GUIDE: 'GUIDE',
  EDITOR: 'EDITOR',
  CONFIDANT: 'CONFIDANT',
  ONIRIQUE: 'ONIRIQUE',
  NARRATOR: 'NARRATOR',
};
