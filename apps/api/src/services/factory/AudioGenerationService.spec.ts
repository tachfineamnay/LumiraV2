import { ConfigService } from '@nestjs/config';
import { AudioVoice } from '@prisma/client';
import { AudioGenerationService } from './AudioGenerationService';

jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: jest.fn(),
  })),
  protos: {},
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));

describe('AudioGenerationService managed job gate', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'AUDIO_ALLOW_LEGACY_FIRE_AND_FORGET') return 'false';
      if (key === 'TTS_USE_JOURNEY_VOICES') return 'false';
      return fallback;
    }),
  } as unknown as ConfigService;

  function createPrisma(expertReview: unknown) {
    return {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'LUM-1',
          userId: 'user-1',
          expertReview,
          user: { profile: { preferredVoice: AudioVoice.FEMININE } },
        }),
      },
      insight: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      spiritualPath: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      orderFile: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
  }

  it('ignores the historical fire-and-forget call without a managed audio job', async () => {
    const prisma = createPrisma(null);
    const service = new AudioGenerationService(config, prisma as never);

    await expect(service.generateAllAudio('order-1')).resolves.toBeUndefined();

    expect(prisma.insight.findMany).not.toHaveBeenCalled();
    expect(prisma.spiritualPath.findUnique).not.toHaveBeenCalled();
  });

  it('executes only when the Desk owns a running AUDIO_GENERATION job', async () => {
    const prisma = createPrisma({
      production: {
        id: 'prod-1',
        type: 'AUDIO_GENERATION',
        status: 'RUNNING',
        stage: 'GENERATING_AUDIO',
      },
    });
    const service = new AudioGenerationService(config, prisma as never);

    await expect(service.generateAllAudio('order-1')).rejects.toThrow(
      'Aucune synthèse validée n’est disponible',
    );

    expect(prisma.insight.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { category: 'asc' },
    });
    expect(prisma.spiritualPath.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });
});
