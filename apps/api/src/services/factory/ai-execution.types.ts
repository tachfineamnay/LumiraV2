import { AiMission, ProductLevel } from '@prisma/client';

export type AgentType = 'SCRIBE' | 'GUIDE' | 'EDITOR' | 'CONFIDANT' | 'ONIRIQUE' | 'NARRATOR';
export type AiThinkingLevel = 'low' | 'medium' | 'high';

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

export interface AiAgentModelConfig {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  /** Unified production control for models exposing an explicit thinking level. */
  thinkingLevel?: AiThinkingLevel;
  /** Legacy OpenAI field retained for backward-compatible stored configurations. */
  reasoningEffort?: AiThinkingLevel;
  verbosity?: AiThinkingLevel;
  temperature?: number;
  topP?: number;
  maxOutputTokens: number;
}

export interface AiModelConfigSnapshot {
  providerMode: AiProviderMode;
  agents: Record<AgentType, AiAgentModelConfig>;
}

export interface ResolvedAiExecution {
  provider: AiProvider;
  model: string;
  temperature?: number;
  topP?: number;
  thinkingLevel?: AiThinkingLevel;
  /** Legacy fallback for historical OpenAI configurations. */
  reasoningEffort?: AiThinkingLevel;
  verbosity?: AiThinkingLevel;
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
