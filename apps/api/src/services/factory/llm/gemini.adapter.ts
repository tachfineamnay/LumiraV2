import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { sanitizeGoogleJsonSchema } from './google-schema';
import { JsonSchema, LlmAdapter, LlmRequest, LlmResult } from './llm.types';

export type GeminiApiKeyLoader = () => string | null | undefined;

export class GeminiAdapter implements LlmAdapter {
  readonly id = 'gemini' as const;

  constructor(private readonly loadApiKey: GeminiApiKeyLoader) {}

  async complete(req: LlmRequest): Promise<LlmResult> {
    const apiKey = this.loadApiKey()?.trim();
    if (!apiKey) {
      throw new Error('gemini_not_configured: GEMINI_API_KEY absente.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature ?? 0.4,
      topP: req.topP ?? 0.9,
    };
    if (req.jsonSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = this.toGeminiSchema(
        sanitizeGoogleJsonSchema(req.jsonSchema.schema),
      );
    }

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

    const model = genAI.getGenerativeModel({
      model: req.model,
      systemInstruction: req.systemPrompt,
      generationConfig: generationConfig as never,
    });

    const result = await this.withAbort(
      model.generateContent({
        contents: [{ role: 'user', parts }],
      }),
      req.signal,
      req.timeoutMs,
    );

    const text = result.response.text()?.trim() ?? '';
    if (!text) throw new Error('Réponse Gemini vide.');

    const usage = result.response.usageMetadata;
    return {
      text,
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
    };
  }

  /**
   * Google AI Studio SDK expects SchemaType enums; keep a best-effort mapping
   * from plain JSON Schema produced by Lumira workflows.
   */
  private toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
    const typeMap: Record<string, SchemaType> = {
      object: SchemaType.OBJECT,
      array: SchemaType.ARRAY,
      string: SchemaType.STRING,
      number: SchemaType.NUMBER,
      integer: SchemaType.INTEGER,
      boolean: SchemaType.BOOLEAN,
    };

    const walk = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(walk);
      if (typeof node !== 'object' || node === null) return node;
      const record = node as Record<string, unknown>;
      const next: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (key === 'type' && typeof value === 'string' && typeMap[value]) {
          next.type = typeMap[value];
        } else if (typeof value === 'object' && value !== null) {
          next[key] = walk(value);
        } else {
          next[key] = value;
        }
      }
      return next;
    };

    return walk(schema) as Record<string, unknown>;
  }

  private async withAbort<T>(
    promise: Promise<T>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<T> {
    if (signal.aborted) throw new Error('Gemini request aborted');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Gemini timeout après ${timeoutMs}ms`)), timeoutMs);
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
}
