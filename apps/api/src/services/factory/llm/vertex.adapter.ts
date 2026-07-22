import {
  createVertexAiClient,
  generateWithGoogleGenAi,
  parseVertexAccountFromJson,
} from './google-genai.client';
import { LlmAdapter, LlmRequest, LlmResult } from './llm.types';
import { formatProviderError } from './ai-errors';
import { DEFAULT_VERTEX_LOCATION, resolveVertexLocation } from './vertex-location';

export type VertexCredentialsLoader = () => Promise<string | null>;

/**
 * Vertex AI adapter (Google Cloud service account).
 * Uses @google/genai with vertexai=true — never GEMINI_API_KEY.
 */
export class VertexAdapter implements LlmAdapter {
  readonly id = 'vertex' as const;
  private readonly location: string;

  constructor(
    private readonly loadCredentials: VertexCredentialsLoader,
    location?: string,
  ) {
    this.location = resolveVertexLocation(location ?? DEFAULT_VERTEX_LOCATION);
  }

  getLocation(): string {
    return this.location;
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    const json = await this.loadCredentials();
    if (!json?.trim()) {
      throw new Error('vertex_not_configured: identifiants Vertex absents.');
    }

    const account = parseVertexAccountFromJson(json);
    try {
      const client = createVertexAiClient(account, this.location);
      return await generateWithGoogleGenAi(client, req, {
        businessProvider: 'vertex',
        authMode: 'service_account',
        location: this.location,
        projectId: account.project_id,
      });
    } catch (error) {
      throw formatProviderError('vertex', req.model, error, {
        location: this.location,
      });
    }
  }
}
