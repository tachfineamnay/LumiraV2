import { ConfigService } from '@nestjs/config';
import { AudioVoice } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { AudioGenerationService } from './AudioGenerationService';

const mockSynthesizeSpeech = jest.fn();
const mockS3Send = jest.fn();

jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: mockSynthesizeSpeech,
  })),
  protos: {},
}));

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

describe('AudioGenerationService managed sealed narration', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'AUDIO_ALLOW_LEGACY_FIRE_AND_FORGET') return 'false';
      if (key === 'AUDIO_GENERATE_INSIGHTS') return 'false';
      if (key === 'TTS_USE_JOURNEY_VOICES') return 'false';
      if (key === 'AUDIO_TTS_CHUNK_CHARACTERS') return '3500';
      return fallback;
    }),
  } as unknown as ConfigService;

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
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      tx,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockSynthesizeSpeech.mockResolvedValue([{ audioContent: Buffer.from([1, 2, 3, 4]) }]);
    mockS3Send.mockResolvedValue({});
  });

  it('refuses the historical fire-and-forget call without a managed audio job', async () => {
    const prisma = createPrisma(null);
    const service = new AudioGenerationService(config, prisma as never);

    await expect(service.generateAllAudio('order-1')).rejects.toThrow(
      'Aucun job audio géré par le Desk',
    );

    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it('requires an immutable sealed reading version', async () => {
    const prisma = createPrisma({
      production: { type: 'AUDIO_GENERATION', status: 'RUNNING', stage: 'GENERATING_AUDIO' },
    });
    const service = new AudioGenerationService(config, prisma as never);

    await expect(service.generateAllAudio('order-1')).rejects.toThrow(
      'Aucune version scellée et valide',
    );
    expect(mockSynthesizeSpeech).not.toHaveBeenCalled();
  });

  it('stores the full audio under the exact sealed version content hash', async () => {
    const prisma = createPrisma(
      {
        production: { type: 'AUDIO_GENERATION', status: 'RUNNING', stage: 'GENERATING_AUDIO' },
      },
      [
        {
          id: 'version-2',
          version: 2,
          status: 'SEALED',
          contentHash: '1234567890abcdef-rest-of-hash',
          content: sealedContent,
        },
      ],
    );
    const service = new AudioGenerationService(config, prisma as never);

    const result = await service.generateAllAudio('order-1');

    expect(result).toEqual({
      fileId: 'audio-file-1',
      storageKey: 'audio/readings/LUM-1/v2-1234567890abcdef-lecture-complete.mp3',
      readingVersionId: 'version-2',
      contentHash: '1234567890abcdef-rest-of-hash',
      size: 4,
    });
    expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: result.storageKey,
        ContentType: 'audio/mpeg',
        Metadata: expect.objectContaining({
          readingVersionId: 'version-2',
          contentHash: '1234567890abcdef-rest-of-hash',
        }),
      }),
    );
    expect(prisma.tx.orderFile.deleteMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', type: 'AUDIO_READING' },
    });
    expect(prisma.tx.orderFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        key: result.storageKey,
        type: 'AUDIO_READING',
        size: 4,
      }),
    });
  });
});
