import OpenAI from 'openai';
import { formatProviderError } from './ai-errors';
import { LlmAdapter, LlmRequest, LlmResult } from './llm.types';
import { getModelRuntimeControls } from '../model-runtime-controls';

export class OpenAiAdapter implements LlmAdapter {
  readonly id = 'openai' as const;

  constructor(private readonly client: OpenAI) {}

  async complete(req: LlmRequest): Promise<LlmResult> {
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

      const response = await this.client.responses.create(
        {
          model: req.model,
          instructions: req.systemPrompt,
          input: input as unknown as Parameters<typeof this.client.responses.create>[0]['input'],
          store: false,
          ...this.openAIParameters(req),
          text: this.textFormat(req),
        } as Parameters<typeof this.client.responses.create>[0],
        { signal: req.signal, timeout: req.timeoutMs, maxRetries: 0 },
      );

      return this.responseResult(response);
    } catch (error) {
      throw formatProviderError('openai', req.model, error);
    }
  }

  private openAIParameters(req: LlmRequest): Record<string, unknown> {
    const controls = getModelRuntimeControls('openai', req.model);
    const params: Record<string, unknown> = {
      max_output_tokens: req.maxTokens,
    };
    if (
      controls.thinkingLevels.length > 0 &&
      req.thinkingLevel &&
      controls.thinkingLevels.includes(req.thinkingLevel)
    ) {
      params.reasoning = { effort: req.thinkingLevel };
    }
    return params;
  }

  private textFormat(req: LlmRequest): Record<string, unknown> {
    const controls = getModelRuntimeControls('openai', req.model);
    return {
      ...(controls.supportsVerbosity ? { verbosity: req.verbosity ?? 'medium' } : {}),
      ...(req.jsonSchema
        ? {
            format: {
              type: 'json_schema',
              name: req.jsonSchema.name,
              strict: true,
              schema: req.jsonSchema.schema,
            },
          }
        : {}),
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
