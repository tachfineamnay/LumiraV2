import { ConfigService } from '@nestjs/config';
import { AudioVoice } from '@prisma/client';
import { GeminiTtsProvider } from './GeminiTtsProvider';

const mockInteractionsCreate = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    interactions: {
      create: mockInteractionsCreate,
    },
  })),
}));

describe('GeminiTtsProvider', () => {
  let provider: GeminiTtsProvider;
  let configMap: Record<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    configMap = {
      GEMINI_API_KEY: 'test-api-key',
      GEMINI_TTS_MODEL: 'gemini-3.1-flash-tts-preview',
      GEMINI_TTS_VOICE_FEMININE: 'Gacrux',
      GEMINI_TTS_VOICE_MASCULINE: 'Iapetus',
      AUDIO_TTS_CHUNK_CHARACTERS: '2800',
      GEMINI_TTS_TIMEOUT_MS: '5000',
      GEMINI_TTS_MAX_ATTEMPTS: '2',
    };

    const configService = {
      get: jest.fn((key: string, fallback?: string) => configMap[key] ?? fallback),
    } as unknown as ConfigService;

    provider = new GeminiTtsProvider(configService);
  });

  describe('Voice resolution', () => {
    it('maps AudioVoice.FEMININE to configured feminine voice (Gacrux)', () => {
      expect(provider.resolveVoice(AudioVoice.FEMININE)).toBe('Gacrux');
    });

    it('maps AudioVoice.MASCULINE to configured masculine voice (Iapetus)', () => {
      expect(provider.resolveVoice(AudioVoice.MASCULINE)).toBe('Iapetus');
    });
  });

  describe('Transcript cleaning', () => {
    it('removes code blocks, markdown tags, and HTML/SSML without adding SSML', () => {
      const input = `# Title\n\n**Bold text** with [link](http://test.com) and \`code\`.\n\n\`\`\`ts\nconst x = 1;\n\`\`\`\n<speak><break time="500ms"/></speak>`;
      const cleaned = provider.cleanTranscriptForGemini(input);

      expect(cleaned).not.toContain('```');
      expect(cleaned).not.toContain('# Title');
      expect(cleaned).not.toContain('**');
      expect(cleaned).not.toContain('<speak>');
      expect(cleaned).not.toContain('<break');
      expect(cleaned).toContain('Bold text');
      expect(cleaned).toContain('link');
    });
  });

  describe('Chunking', () => {
    it('splits text by paragraphs and sentences without cutting mid-word', () => {
      const paragraph1 = 'Premier paragraphe. '.repeat(50);
      const paragraph2 = 'Deuxième paragraphe. '.repeat(50);
      const fullText = `${paragraph1}\n\n${paragraph2}`;

      const chunks = provider.splitIntoChunks(fullText, 500);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(500);
      }
    });

    it('merges small chunks under 300 characters when possible', () => {
      const short1 = 'Court 1.';
      const short2 = 'Court 2.';
      const fullText = `${short1}\n\n${short2}`;

      const chunks = provider.splitIntoChunks(fullText, 2800);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain('Court 1.');
      expect(chunks[0]).toContain('Court 2.');
    });
  });

  describe('PCM validation', () => {
    it('accepts valid PCM buffer with duration > 250ms and even size', () => {
      // 24000 Hz * 1 channel * 2 bytes/sample = 48000 bytes/sec
      // 500ms = 24000 bytes
      const validPcm = Buffer.alloc(24000);
      const base64 = validPcm.toString('base64');
      const response = { output_audio: { data: base64 } };

      const extracted = provider.extractAndValidatePcm(response, {
        sampleRate: 24000,
        channels: 1,
        sampleWidthBytes: 2,
      });

      expect(extracted).toEqual(validPcm);
    });

    it('rejects empty PCM buffer', () => {
      const response = { output_audio: { data: Buffer.alloc(0).toString('base64') } };

      expect(() =>
        provider.extractAndValidatePcm(response, {
          sampleRate: 24000,
          channels: 1,
          sampleWidthBytes: 2,
        }),
      ).toThrow(/sans données audio|vide/i);
    });

    it('rejects odd size PCM buffer for 16-bit audio', () => {
      const oddBuffer = Buffer.alloc(24001);
      const response = { output_audio: { data: oddBuffer.toString('base64') } };

      expect(() =>
        provider.extractAndValidatePcm(response, {
          sampleRate: 24000,
          channels: 1,
          sampleWidthBytes: 2,
        }),
      ).toThrow(/impaire/i);
    });

    it('rejects short audio < 250ms', () => {
      const shortBuffer = Buffer.alloc(100); // ~2ms
      const response = { output_audio: { data: shortBuffer.toString('base64') } };

      expect(() =>
        provider.extractAndValidatePcm(response, {
          sampleRate: 24000,
          channels: 1,
          sampleWidthBytes: 2,
        }),
      ).toThrow('inférieure à 250ms');
    });
  });

  describe('Retry classification', () => {
    it('identifies retryable errors (429, timeout, 500)', () => {
      expect(provider.isRetryableError(new Error('Rate limit 429 exceeded'))).toBe(true);
      expect(provider.isRetryableError(new Error('Request timeout'))).toBe(true);
      expect(provider.isRetryableError(new Error('Internal server error 500'))).toBe(true);
    });

    it('rejects non-retryable errors (invalid API key 401)', () => {
      expect(provider.isRetryableError(new Error('API_KEY_INVALID 401'))).toBe(false);
      expect(provider.isRetryableError(new Error('Model not found 404'))).toBe(false);
    });
  });
});
