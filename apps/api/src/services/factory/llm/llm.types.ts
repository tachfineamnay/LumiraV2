import { AiProvider, AiThinkingLevel } from '../ai-execution.types';

export type JsonSchema = Record<string, unknown>;

export type VisualAssetRole = 'FACE_FRONT' | 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';

export type ImagePayload = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
  /** Role is repeated beside the binary part by every adapter. Never rely on order. */
  role: VisualAssetRole;
};

export interface LlmRequest {
  model: string;
  systemPrompt: string;
  userContent: string;
  images?: ImagePayload[];
  maxTokens: number;
  thinkingLevel?: AiThinkingLevel;
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
