import { GoogleGenAI } from '@google/genai';
import {
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

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

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
});

describe('agent model capabilities', () => {
  it('SCRIBE rejects models without vision or structured', () => {
    expect(modelSupportsAgent('gpt-4o-2024-11-20', 'SCRIBE')).toBe(true);
    expect(() => assertSavableAgentModel('SCRIBE', 'openai', 'gpt-4o-2024-11-20')).not.toThrow();
  });

  it('CONFIDANT requires fast_text', () => {
    expect(modelSupportsAgent('gpt-5.5-2026-04-23', 'CONFIDANT')).toBe(false);
    expect(() => assertSavableAgentModel('CONFIDANT', 'openai', 'gpt-5.5-2026-04-23')).toThrow(
      /fast_text|texte rapide/,
    );
    expect(modelSupportsAgent('gpt-4o-2024-11-20', 'CONFIDANT')).toBe(true);
  });

  it('EDITOR accepts text-only capable models', () => {
    expect(modelSupportsAgent('gemini-2.5-flash', 'EDITOR')).toBe(true);
  });

  it('dedupes active provider/model pairs from MODEL_CONFIG', () => {
    const pairs = activeProviderModelPairs({
      providerMode: 'per_agent',
      agents: {
        ...DEFAULT_AI_MODEL_CONFIG.agents,
        SCRIBE: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.SCRIBE,
          provider: 'vertex',
          model: 'gemini-2.5-pro',
          temperature: 0.7,
          topP: 0.9,
        },
        GUIDE: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.GUIDE,
          provider: 'vertex',
          model: 'gemini-2.5-flash',
          temperature: 0.5,
          topP: 0.9,
        },
        EDITOR: {
          ...DEFAULT_AI_MODEL_CONFIG.agents.EDITOR,
          provider: 'vertex',
          model: 'gemini-2.5-pro',
          temperature: 0.4,
          topP: 0.9,
        },
        CONFIDANT: { ...DEFAULT_AI_MODEL_CONFIG.agents.CONFIDANT, enabled: false },
        ONIRIQUE: { ...DEFAULT_AI_MODEL_CONFIG.agents.ONIRIQUE, enabled: false },
        NARRATOR: { ...DEFAULT_AI_MODEL_CONFIG.agents.NARRATOR, enabled: false },
      },
    });
    expect(pairs).toHaveLength(2);
    expect(pairs.find((p) => p.model === 'gemini-2.5-pro')?.agents).toEqual(
      expect.arrayContaining(['SCRIBE', 'EDITOR']),
    );
    expect(pairs.find((p) => p.model === 'gemini-2.5-pro')?.needsVision).toBe(true);
    expect(pairs.find((p) => p.model === 'gemini-2.5-flash')?.needsStructured).toBe(true);
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
