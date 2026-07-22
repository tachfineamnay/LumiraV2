import { GoogleGenAI } from '@google/genai';
import { sanitizeGoogleJsonSchema } from './google-schema';
import { parseVertexServiceAccount, VertexServiceAccount } from './settings-crypto';
import { ImagePayload, JsonSchema, LlmRequest, LlmResult } from './llm.types';
import { resolveVertexLocation } from './vertex-location';

export type GoogleAuthMode = 'api_key' | 'service_account';

export interface GoogleGenAiCallMeta {
  businessProvider: 'gemini' | 'vertex';
  authMode: GoogleAuthMode;
  location?: string;
  projectId?: string;
}

export function createGeminiDeveloperClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    vertexai: false,
  });
}

export function createVertexAiClient(account: VertexServiceAccount, location: string): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: account.project_id,
    location,
    googleAuthOptions: {
      credentials: account as never,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    },
  });
}

export function buildGoogleContents(req: LlmRequest): Array<{
  role: 'user';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: req.userContent },
  ];
  for (const image of req.images ?? []) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64,
      },
    });
  }
  return [{ role: 'user', parts }];
}

export function buildGoogleGenerationConfig(req: LlmRequest): Record<string, unknown> {
  const config: Record<string, unknown> = {
    maxOutputTokens: req.maxTokens,
    temperature: req.temperature ?? 0.4,
    topP: req.topP ?? 0.9,
    systemInstruction: req.systemPrompt,
    abortSignal: req.signal,
  };
  if (req.jsonSchema) {
    config.responseMimeType = 'application/json';
    // Prefer responseJsonSchema (JSON Schema subset) over legacy Schema enums.
    config.responseJsonSchema = sanitizeGoogleJsonSchema(req.jsonSchema.schema);
  }
  return config;
}

export async function generateWithGoogleGenAi(
  client: GoogleGenAI,
  req: LlmRequest,
  meta: GoogleGenAiCallMeta,
): Promise<LlmResult> {
  const response = await withLocalTimeout(
    client.models.generateContent({
      model: req.model,
      contents: buildGoogleContents(req),
      config: buildGoogleGenerationConfig(req) as never,
    }),
    req.signal,
    req.timeoutMs,
    meta.businessProvider,
  );

  const text = typeof response.text === 'string' ? response.text.trim() : '';
  if (!text) {
    throw new Error(`${providerLabel(meta.businessProvider)} — modèle ${req.model}: réponse vide.`);
  }

  const usage = response.usageMetadata;
  return {
    text,
    inputTokens: typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : undefined,
    outputTokens:
      typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : undefined,
  };
}

export function describeGoogleCall(meta: GoogleGenAiCallMeta, model: string): string {
  const parts = [`provider=${meta.businessProvider}`, `auth=${meta.authMode}`, `model=${model}`];
  if (meta.location) parts.push(`location=${meta.location}`);
  if (meta.projectId) parts.push(`project=${meta.projectId}`);
  return parts.join(' ');
}

export function parseVertexAccountFromJson(json: string): VertexServiceAccount {
  return parseVertexServiceAccount(json);
}

export function vertexLocationFromEnv(reader?: {
  get?<T = string>(key: string, defaultValue?: T): T | undefined;
}): string {
  return resolveVertexLocation(reader);
}

function providerLabel(provider: 'gemini' | 'vertex'): string {
  return provider === 'gemini' ? 'Gemini API' : 'Vertex AI';
}

async function withLocalTimeout<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
  provider: 'gemini' | 'vertex',
): Promise<T> {
  if (signal.aborted) {
    throw new Error(`${providerLabel(provider)} request aborted`);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${providerLabel(provider)} timeout après ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  const onAbort = () => {
    if (timer) clearTimeout(timer);
  };
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/** Exported for unit tests — ensures image payloads stay typed. */
export function assertImagePayload(image: ImagePayload): ImagePayload {
  return image;
}

/** Exported for unit tests — schema passthrough shape. */
export function asJsonSchema(schema: JsonSchema): JsonSchema {
  return schema;
}
