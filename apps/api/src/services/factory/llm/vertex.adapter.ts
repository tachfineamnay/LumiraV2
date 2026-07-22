import { VertexAI } from '@google-cloud/vertexai';
import { sanitizeGoogleJsonSchema } from './google-schema';
import { parseVertexServiceAccount, VertexServiceAccount } from './settings-crypto';
import { LlmAdapter, LlmRequest, LlmResult } from './llm.types';

export type VertexCredentialsLoader = () => Promise<string | null>;

const DEFAULT_LOCATION = 'us-central1';

export class VertexAdapter implements LlmAdapter {
  readonly id = 'vertex' as const;

  constructor(
    private readonly loadCredentials: VertexCredentialsLoader,
    private readonly location = DEFAULT_LOCATION,
  ) {}

  async complete(req: LlmRequest): Promise<LlmResult> {
    const json = await this.loadCredentials();
    if (!json?.trim()) {
      throw new Error('vertex_not_configured: identifiants Vertex absents.');
    }

    const account = parseVertexServiceAccount(json);
    const client = this.createClient(account);
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature ?? 0.7,
      topP: req.topP ?? 0.9,
    };
    if (req.jsonSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = sanitizeGoogleJsonSchema(req.jsonSchema.schema);
    }

    const parts: Array<Record<string, unknown>> = [{ text: req.userContent }];
    for (const image of req.images ?? []) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64,
        },
      });
    }

    const model = client.getGenerativeModel({
      model: req.model,
      systemInstruction: req.systemPrompt,
      generationConfig: generationConfig as never,
    });

    const result = await this.withAbort(
      model.generateContent({
        contents: [{ role: 'user', parts: parts as never }],
      }),
      req.signal,
      req.timeoutMs,
    );

    const text = result.response.candidates?.[0]?.content?.parts
      ?.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (!text) throw new Error('Réponse Vertex vide.');

    const usage = result.response.usageMetadata;
    return {
      text,
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
    };
  }

  private createClient(account: VertexServiceAccount): VertexAI {
    return new VertexAI({
      project: account.project_id,
      location: this.location,
      googleAuthOptions: {
        credentials: account as never,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      },
    });
  }

  private async withAbort<T>(
    promise: Promise<T>,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<T> {
    if (signal.aborted) throw new Error('Vertex request aborted');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Vertex timeout après ${timeoutMs}ms`)), timeoutMs);
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
