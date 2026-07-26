import OpenAI from 'openai';
import { formatProviderError } from './ai-errors';
import { LlmAdapter, LlmRequest, LlmResult } from './llm.types';
import { getModelRuntimeControls } from '../model-runtime-controls';

export class OpenAiAdapter implements LlmAdapter {
  readonly id = 'openai' as const;

  constructor(private readonly client: OpenAI) {}

  async complete(req: LlmRequest): Promise<LlmResult> {
    const controls = getModelRuntimeControls('openai', req.model);
    if (!controls.operational || controls.thinkingLevels.length === 0) {
      throw new Error(
        `OpenAI — le modèle ${req.model} n'est pas autorisé pour la production Lumira.`,
      );
    }
    if (!req.thinkingLevel || !controls.thinkingLevels.includes(req.thinkingLevel)) {
      throw new Error(
        `OpenAI — un niveau de réflexion valide est obligatoire pour ${req.model} (${controls.thinkingLevels.join(', ')}).`,
      );
    }

    try {
      const input =
        req.images && req.images.length > 0
          ? [
              {
                role: 'user' as const,
                content: [
                  { type: 'input_text' as const, text: req.userContent },
                  ...req.images.map((image) => ({
                    type: 'input_image' as const,
                    image_url: `data:${image.mimeType};base64,${image.base64}`,
                    detail: 'high' as const,
                  })),
                ],
              },
            ]
          : req.userContent;

      const payload: Record<string, unknown> = {
        model: req.model,
        instructions: req.systemPrompt,
        input,
        store: false,
        reasoning: { effort: req.thinkingLevel },
        max_output_tokens: req.maxTokens,
      };

      const textFmt = this.textFormat(req);
      if (textFmt) {
        payload.text = textFmt;
      }

      const response = await this.client.responses.create(
        payload as Parameters<typeof this.client.responses.create>[0],
        { signal: req.signal, timeout: req.timeoutMs, maxRetries: 0 },
      );

      return this.responseResult(response);
    } catch (error) {
      throw formatProviderError('openai', req.model, error);
    }
  }

  private textFormat(req: LlmRequest): Record<string, unknown> | undefined {
    if (!req.jsonSchema) return undefined;
    return {
      format: {
        type: 'json_schema',
        name: req.jsonSchema.name,
        strict: true,
        schema: req.jsonSchema.schema,
      },
    };
  }

  private responseResult(response: unknown): LlmResult {
    const value = response as {
      status?: string;
      output_text?: unknown;
      incomplete_details?: { reason?: string };
      usage?: { input_tokens?: unknown; output_tokens?: unknown };
    };
    if (value.status === 'incomplete') {
      throw new Error(
        `Réponse OpenAI incomplète: ${value.incomplete_details?.reason || 'cause inconnue'}`,
      );
    }
    const text = typeof value.output_text === 'string' ? value.output_text.trim() : '';
    if (!text) throw new Error('Réponse OpenAI vide.');
    return {
      text,
      inputTokens:
        typeof value.usage?.input_tokens === 'number' ? value.usage.input_tokens : undefined,
      outputTokens:
        typeof value.usage?.output_tokens === 'number' ? value.usage.output_tokens : undefined,
    };
  }
}
