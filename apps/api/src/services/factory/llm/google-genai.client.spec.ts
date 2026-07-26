import { GoogleGenAI } from '@google/genai';
import {
  buildGoogleGenerationConfig,
  buildGoogleContents,
  createGeminiDeveloperClient,
  createVertexAiClient,
  GOOGLE_GENAI_API_VERSION,
} from './google-genai.client';
import {
  assertSavableAgentModel,
  activeProviderModelPairs,
  modelSupportsAgent,
} from '../ai-model-config';
import { DEFAULT_AI_MODEL_CONFIG } from '../ai-model-config';
import { classifyNormalizedAiError } from './ai-errors';
import { LlmRequest } from './llm.types';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

function request(overrides: Partial<LlmRequest> = {}): LlmRequest {
  return {
    model: 'gemini-3.6-flash',
    systemPrompt: 'system',
    userContent: 'user',
    maxTokens: 2000,
    signal: new AbortController().signal,
    timeoutMs: 30_000,
    ...overrides,
  };
}

describe('google-genai.client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates Gemini Developer client with apiKey, vertexai false and stable apiVersion', () => {
    createGeminiDeveloperClient('test-key');
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      vertexai: false,
      apiVersion: GOOGLE_GENAI_API_VERSION,
    });
  });

  it('creates Vertex client with service account auth and never apiKey', () => {
    createVertexAiClient(
      {
        type: 'service_account',
        project_id: 'demo',
        client_email: 'a@b.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----\n',
      },
      'us-central1',
    );
    const options = (GoogleGenAI as unknown as jest.Mock).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(options.vertexai).toBe(true);
    expect(options.project).toBe('demo');
    expect(options.location).toBe('us-central1');
    expect(options.apiVersion).toBe('v1');
    expect(options.apiKey).toBeUndefined();
    expect(options.googleAuthOptions).toBeTruthy();
  });

  it.each(['minimal', 'low', 'medium', 'high'] as const)(
    'maps gemini-3.6-flash thinkingLevel=%s without exposing thoughts',
    (thinkingLevel) => {
      const config = buildGoogleGenerationConfig('gemini', request({ thinkingLevel }));
      expect(config.thinkingConfig).toEqual({
        thinkingLevel: thinkingLevel.toUpperCase(),
        includeThoughts: false,
      });
      expect(config.temperature).toBeUndefined();
      expect(config.topP).toBeUndefined();
      expect(config.topK).toBeUndefined();
    },
  );

  it('throws an error for a request without a thinking level', () => {
    expect(() => buildGoogleGenerationConfig('gemini', request())).toThrow(
      /un niveau de réflexion valide est obligatoire/,
    );
  });

  it('throws an error for non-operational gemini-2.5-flash', () => {
    expect(() =>
      buildGoogleGenerationConfig(
        'gemini',
        request({ model: 'gemini-2.5-flash', thinkingLevel: 'high' as any, maxTokens: 256 }),
      ),
    ).toThrow(/n'est pas autorisé pour la production Lumira/);
  });

  it('places each binary image beside its verified role instead of relying on order', () => {
    const parts = buildGoogleContents(
      request({
        images: [{ mimeType: 'image/png', base64: 'cGFsbQ==', role: 'PALM_UNKNOWN' }],
      }),
    )[0].parts;
    expect(parts).toEqual([
      { text: 'user' },
      { text: 'Image suivante — rôle vérifié: PALM_UNKNOWN.' },
      { inlineData: { mimeType: 'image/png', data: 'cGFsbQ==' } },
    ]);
  });
});

describe('agent model capabilities', () => {
  it('refuses legacy models without thinking control like gpt-4o', () => {
    expect(modelSupportsAgent('gpt-4o-2024-11-20', 'SCRIBE')).toBe(false);
    expect(() => assertSavableAgentModel('SCRIBE', 'openai', 'gpt-4o-2024-11-20')).toThrow();
  });

  it('CONFIDANT accepts a thinking-capable text model with explicit thinkingLevel', () => {
    expect(modelSupportsAgent('gpt-5.5-2026-04-23', 'CONFIDANT')).toBe(true);
    expect(() =>
      assertSavableAgentModel('CONFIDANT', 'openai', 'gpt-5.5-2026-04-23', 'low'),
    ).not.toThrow();
  });

  it('refuses gemini-2.5-flash for EDITOR', () => {
    expect(modelSupportsAgent('gemini-2.5-flash', 'EDITOR')).toBe(false);
  });

  it('dedupes active provider/model pairs from MODEL_CONFIG', () => {
    const pairs = activeProviderModelPairs({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.SCRIBE,
          provider: 'vertex',
          model: 'gemini-3.6-flash',
          thinkingLevel: 'high',
        },
        GUIDE: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.GUIDE,
          provider: 'vertex',
          model: 'gemini-3.5-flash',
          thinkingLevel: 'medium',
        },
        EDITOR: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.EDITOR,
          provider: 'vertex',
          model: 'gemini-3.6-flash',
          thinkingLevel: 'medium',
        },
        CONFIDANT: { ...DEFAULT_AI_MODEL_CONFIG.agents.CONFIDANT, enabled: false },
        ONIRIQUE: { ...DEFAULT_AI_MODEL_CONFIG.agents.ONIRIQUE, enabled: false },
        NARRATOR: { ...DEFAULT_AI_MODEL_CONFIG.agents.NARRATOR, enabled: false },
      },
    });
    expect(pairs).toHaveLength(2);
    expect(pairs.find((p) => p.model === 'gemini-3.6-flash')?.agents).toEqual(
      expect.arrayContaining(['SCRIBE', 'EDITOR']),
    );
    expect(pairs.find((p) => p.model === 'gemini-3.6-flash')?.needsVision).toBe(true);
    expect(pairs.find((p) => p.model === 'gemini-3.5-flash')?.needsStructured).toBe(true);
  });
});

describe('error classification priority', () => {
  it('classifies region errors before model_not_found', () => {
    expect(classifyNormalizedAiError('location us-central1 not found for publisher model')).toBe(
      'region_not_supported',
    );
  });

  it('classifies structured output before model_not_found', () => {
    expect(classifyNormalizedAiError('response_schema is not supported for this model')).toBe(
      'structured_output_unsupported',
    );
  });
});
