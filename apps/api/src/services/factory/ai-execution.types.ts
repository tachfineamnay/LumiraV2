import { AiMission, ProductLevel } from '@prisma/client';

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
  agentProviders: Record<AgentType, 'gemini' | 'openai'>;
}

export interface AiModelConfigSnapshot {
  heavyModel: string;
  flashModel: string;
  heavyTemperature: number;
  heavyTopP: number;
  heavyMaxTokens: number;
  flashTemperature: number;
  flashTopP: number;
  flashMaxTokens: number;
  openaiHeavyModel: string;
  openaiFlashModel: string;
  openaiHeavyTemperature: number;
  openaiHeavyTopP: number;
  openaiHeavyMaxTokens: number;
  openaiFlashTemperature: number;
  openaiFlashTopP: number;
  openaiFlashMaxTokens: number;
}

export interface ResolvedAiExecution {
  provider: 'gemini' | 'openai';
  model: string;
  temperature: number;
  topP: number;
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
