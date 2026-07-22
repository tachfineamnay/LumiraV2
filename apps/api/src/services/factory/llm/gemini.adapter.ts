import { createGeminiDeveloperClient, generateWithGoogleGenAi } from './google-genai.client';
import { LlmAdapter, LlmRequest, LlmResult } from './llm.types';
import { formatProviderError } from './ai-errors';

export type GeminiApiKeyLoader = () => string | null | undefined;

/**
 * Gemini Developer API adapter (AI Studio key).
 * Uses @google/genai with vertexai=false — never Vertex credentials.
 */
export class GeminiAdapter implements LlmAdapter {
  readonly id = 'gemini' as const;

  constructor(private readonly loadApiKey: GeminiApiKeyLoader) {}

  async complete(req: LlmRequest): Promise<LlmResult> {
    const apiKey = this.loadApiKey()?.trim();
    if (!apiKey) {
      throw new Error('gemini_not_configured: GEMINI_API_KEY absente.');
    }

    try {
      const client = createGeminiDeveloperClient(apiKey);
      return await generateWithGoogleGenAi(client, req, {
        businessProvider: 'gemini',
        authMode: 'api_key',
      });
    } catch (error) {
      throw formatProviderError('gemini', req.model, error);
    }
  }
}
