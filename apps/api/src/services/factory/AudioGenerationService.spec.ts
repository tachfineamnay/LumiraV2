import { ConfigService } from '@nestjs/config';
import { AudioVoice } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { AudioGenerationService } from './AudioGenerationService';
import { AudioProviderResult, AudioTtsProvider } from './tts/audio-tts.provider.interface';

const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));

const sealedContent = {
  pdf_content: {
    introduction: 'Introduction de la lecture personnalisée.',
    archetype_reveal: '',
    sections: [
      {
        domain: 'Identité',
        title: 'Votre force principale',
        content: 'Vous avancez avec une grande capacité de perception et de mise en mouvement.',
      },
    ],
    karmic_insights: [],
    life_mission: '',
    rituals: [],
    conclusion: 'Prenez le temps d’intégrer cette lecture.',
  },
  synthesis: {
    archetype: 'Le Visionnaire',
    keywords: ['vision'],
    emotional_state: '',
    key_blockage: '',
  },
  timeline: [],
  lecture:
    '# Votre lecture\n\nVous avancez avec une grande capacité de perception. ' +
    'Prenez le temps de découvrir chaque partie et de laisser résonner les éléments utiles.',
};

describe('AudioGenerationService multi-provider TTS pipeline', () => {
  let configMap: Record<string, string>;

  function createConfigService() {
    return {
      get: jest.fn((key: string, fallback?: string) => configMap[key] ?? fallback),
    } as unknown as ConfigService;
  }

  function createPrisma(expertReview: unknown, readingVersions: unknown[] = []) {
    const tx = {
      orderFile: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'audio-file-1' }),
      },
    };
    return {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'LUM-1',
          userId: 'user-1',
          expertReview,
          readingVersions,
          user: { profile: { preferredVoice: AudioVoice.FEMININE } },
        }),
      },
      insight: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      orderFile: {
        findMany: jest.fn().mockResolvedValue([{ id: 'old-audio', key: 'audio/old.mp3' }]),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      tx,
    };
  }

  function mockProvider(
    name: string,
    model: string,
    voice: string,
    buffer = Buffer.from([1, 2, 3, 4]),
  ): AudioTtsProvider {
    return {
      name,
      synthesizeNarration: jest.fn().mockResolvedValue({
        buffer,
        contentType: 'audio/mpeg',
        extension: 'mp3',
        provider: name,
        model,
        voice,
        chunkCount: 1,
        estimatedDurationSeconds: 10,
      } as AudioProviderResult),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    configMap = {
      AUDIO_ALLOW_LEGACY_FIRE_AND_FORGET: 'false',
      AUDIO_GENERATE_INSIGHTS: 'false',
      AUDIO_TTS_PROVIDER: 'gemini',
      AUDIO_TTS_FALLBACK_PROVIDER: 'google_cloud',
      AUDIO_TTS_FALLBACK_ENABLED: 'true',
      AUDIO_TTS_ALLOW_MIXED_PROVIDERS: 'false',
      AUDIO_TTS_KEEP_EXISTING_ON_FAILURE: 'true',
      GEMINI_TTS_MODEL: 'gemini-3.1-flash-tts-preview',
      GEMINI_TTS_VOICE_FEMININE: 'Gacrux',
      GEMINI_TTS_VOICE_MASCULINE: 'Iapetus',
    };
    mockS3Send.mockResolvedValue({});
  });

  it('19. silently skips when no RUNNING managed audio job is present', async () => {
    const prisma = createPrisma(null);
    const narrator = { reformulate: jest.fn() };
    const service = new AudioGenerationService(
      createConfigService(),
      prisma as never,
      narrator as never,
    );

    await expect(service.generateAllAudio('order-1')).resolves.toBeNull();

    expect(narrator.reformulate).not.toHaveBeenCalled();
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it('20. forbids generation without an immutable SEALED reading version', async () => {
    const prisma = createPrisma({
      production: { type: 'AUDIO_GENERATION', status: 'RUNNING', stage: 'GENERATING_AUDIO' },
    });
    const narrator = { reformulate: jest.fn() };
    const service = new AudioGenerationService(
      createConfigService(),
      prisma as never,
      narrator as never,
    );

    await expect(service.generateAllAudio('order-1')).rejects.toThrow(
      'Aucune version scellée et valide',
    );
    expect(narrator.reformulate).not.toHaveBeenCalled();
  });

  it('1. selects Gemini primary provider by config variable', async () => {
    configMap.AUDIO_TTS_PROVIDER = 'gemini';
    const prisma = createPrisma({ production: { type: 'AUDIO_GENERATION', status: 'RUNNING' } }, [
      {
        id: 'v1',
        version: 1,
        status: 'SEALED',
        contentHash: '1234567890abcdef',
        content: sealedContent,
      },
    ]);

    const geminiMock = mockProvider('gemini', 'gemini-3.1-flash-tts-preview', 'Gacrux');
    const googleMock = mockProvider('google_cloud', 'fr-FR-Journey-F', 'fr-FR-Journey-F');

    const service = new AudioGenerationService(
      createConfigService(),
      prisma as never,
      undefined,
      geminiMock as never,
      googleMock as never,
    );

    const result = await service.generateAllAudio('order-1');

    expect(geminiMock.synthesizeNarration).toHaveBeenCalledTimes(1);
    expect(googleMock.synthesizeNarration).not.toHaveBeenCalled();
    expect(result?.provider).toBe('gemini');
  });

  it('2. selects Google Cloud primary provider when configured', async () => {
    configMap.AUDIO_TTS_PROVIDER = 'google_cloud';
    const prisma = createPrisma({ production: { type: 'AUDIO_GENERATION', status: 'RUNNING' } }, [
      {
        id: 'v1',
        version: 1,
        status: 'SEALED',
        contentHash: '1234567890abcdef',
        content: sealedContent,
      },
    ]);

    const geminiMock = mockProvider('gemini', 'gemini-3.1-flash-tts-preview', 'Gacrux');
    const googleMock = mockProvider('google_cloud', 'fr-FR-Journey-F', 'fr-FR-Journey-F');

    const service = new AudioGenerationService(
      createConfigService(),
      prisma as never,
      undefined,
      geminiMock as never,
      googleMock as never,
    );

    const result = await service.generateAllAudio('order-1');

    expect(googleMock.synthesizeNarration).toHaveBeenCalledTimes(1);
    expect(geminiMock.synthesizeNarration).not.toHaveBeenCalled();
    expect(result?.provider).toBe('google_cloud');
  });

  it('13, 14, 15. primary Gemini failure discards all Gemini chunks and restarts full narration with Google Cloud fallback', async () => {
    configMap.AUDIO_TTS_PROVIDER = 'gemini';
    configMap.AUDIO_TTS_FALLBACK_PROVIDER = 'google_cloud';
    configMap.AUDIO_TTS_FALLBACK_ENABLED = 'true';

    const prisma = createPrisma({ production: { type: 'AUDIO_GENERATION', status: 'RUNNING' } }, [
      {
        id: 'v1',
        version: 1,
        status: 'SEALED',
        contentHash: '1234567890abcdef',
        content: sealedContent,
      },
    ]);

    const geminiMock: AudioTtsProvider = {
      name: 'gemini',
      synthesizeNarration: jest.fn().mockRejectedValue(new Error('Gemini chunk 2 timeout')),
    };

    const googleMock = mockProvider(
      'google_cloud',
      'fr-FR-Journey-F',
      'fr-FR-Journey-F',
      Buffer.from([9, 9, 9, 9]),
    );

    const service = new AudioGenerationService(
      createConfigService(),
      prisma as never,
      undefined,
      geminiMock as never,
      googleMock as never,
    );

    const result = await service.generateAllAudio('order-1');

    expect(geminiMock.synthesizeNarration).toHaveBeenCalledTimes(1);
    expect(googleMock.synthesizeNarration).toHaveBeenCalledTimes(1);
    expect(googleMock.synthesizeNarration).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Vous avancez avec une grande capacité'),
      }),
    );
    expect(result?.provider).toBe('google_cloud');
  });

  it('16. failure of both providers preserves existing OrderFile and throws exception', async () => {
    configMap.AUDIO_TTS_PROVIDER = 'gemini';
    configMap.AUDIO_TTS_FALLBACK_PROVIDER = 'google_cloud';
    configMap.AUDIO_TTS_FALLBACK_ENABLED = 'true';

    const prisma = createPrisma({ production: { type: 'AUDIO_GENERATION', status: 'RUNNING' } }, [
      {
        id: 'v1',
        version: 1,
        status: 'SEALED',
        contentHash: '1234567890abcdef',
        content: sealedContent,
      },
    ]);

    const geminiMock: AudioTtsProvider = {
      name: 'gemini',
      synthesizeNarration: jest.fn().mockRejectedValue(new Error('Gemini error')),
    };
    const googleMock: AudioTtsProvider = {
      name: 'google_cloud',
      synthesizeNarration: jest.fn().mockRejectedValue(new Error('Google Cloud error')),
    };

    const service = new AudioGenerationService(
      createConfigService(),
      prisma as never,
      undefined,
      geminiMock as never,
      googleMock as never,
    );

    await expect(service.generateAllAudio('order-1')).rejects.toThrow('Google Cloud error');

    expect(prisma.tx.orderFile.deleteMany).not.toHaveBeenCalled();
    expect(prisma.tx.orderFile.create).not.toHaveBeenCalled();
  });

  it('17, 18. generated MP3 has non-zero size and includes S3 metadata (provider/model/voice)', async () => {
    const prisma = createPrisma({ production: { type: 'AUDIO_GENERATION', status: 'RUNNING' } }, [
      {
        id: 'v1',
        version: 1,
        status: 'SEALED',
        contentHash: '1234567890abcdef',
        content: sealedContent,
      },
    ]);

    const geminiMock = mockProvider(
      'gemini',
      'gemini-3.1-flash-tts-preview',
      'Gacrux',
      Buffer.from([10, 20, 30, 40, 50]),
    );
    const service = new AudioGenerationService(
      createConfigService(),
      prisma as never,
      undefined,
      geminiMock as never,
      undefined,
    );

    const result = await service.generateAllAudio('order-1');

    expect(result?.size).toBe(5);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ContentType: 'audio/mpeg',
        Metadata: expect.objectContaining({
          ttsProvider: 'gemini',
          ttsModel: 'gemini-3.1-flash-tts-preview',
          ttsVoice: 'Gacrux',
        }),
      }),
    );
  });
});
