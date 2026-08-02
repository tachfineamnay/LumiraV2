export const MEMORY_CATEGORIES = [
  'PREFERENCE',
  'LIFE_CONTEXT',
  'IMPORTANT_EVENT',
  'RECURRING_THEME',
  'EVOLUTION',
  'OPEN_QUESTION',
  'EXPERT_VALIDATED_ANCHOR',
  'READING_CONTINUITY',
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface MemoryCandidate {
  category: string;
  fact: string;
  confidence: number;
  sourceEvidence?: string;
  sensitive?: boolean;
  shouldPersist: boolean;
}

export interface SanitizedMemoryCandidate {
  category: MemoryCategory;
  fact: string;
  confidence: number;
}

export interface VertexMemory {
  name: string;
  fact: string;
  scope: Record<string, string>;
}

export interface VertexMemoryBank {
  isConfigured(): Promise<boolean>;
  isEnabled(): boolean;
  createMemory(input: {
    memoryId: string;
    userId: string;
    fact: string;
    category: MemoryCategory;
  }): Promise<VertexMemory>;
  retrieveMemories(userId: string, query: string, topK?: number): Promise<VertexMemory[]>;
  listUserMemories(userId: string): Promise<VertexMemory[]>;
  updateMemory(name: string, fact: string, expectedUserId: string): Promise<VertexMemory>;
  deleteMemory(name: string, expectedUserId: string): Promise<void>;
  deleteAllUserMemories(userId: string): Promise<number>;
  diagnoseIsolation(userId: string): Promise<{ count: number; isolated: boolean }>;
  close(): Promise<void>;
}

export type MemoryReadinessCode =
  | 'ready'
  | 'memory_disabled'
  | 'model_config_unavailable'
  | 'model_config_missing'
  | 'model_config_invalid'
  | 'provider_mode_invalid'
  | 'memory_agent_disabled'
  | 'memory_provider_invalid'
  | 'memory_model_invalid'
  | 'memory_validation_missing';

export interface MemoryReadiness {
  ready: boolean;
  code: MemoryReadinessCode;
}

export type NormalizedMemoryErrorCode =
  | 'not_configured'
  | 'invalid_parent'
  | 'not_found'
  | 'permission_denied'
  | 'unauthenticated'
  | 'invalid_credentials'
  | 'invalid_argument'
  | 'outside_parent'
  | 'unavailable'
  | 'quota'
  | 'timeout'
  | 'non_retryable';

export class MemoryBankError extends Error {
  constructor(
    readonly code: NormalizedMemoryErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
