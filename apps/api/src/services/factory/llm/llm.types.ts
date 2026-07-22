import { AiProvider } from '../ai-execution.types';

export type JsonSchema = Record<string, unknown>;

export type ImagePayload = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
};

export interface LlmRequest {
  model: string;
  systemPrompt: string;
  userContent: string;
  images?: ImagePayload[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  jsonSchema?: { name: string; schema: JsonSchema };
  signal: AbortSignal;
  timeoutMs: number;
}

export interface LlmResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmAdapter {
  readonly id: AiProvider;
  complete(req: LlmRequest): Promise<LlmResult>;
}
