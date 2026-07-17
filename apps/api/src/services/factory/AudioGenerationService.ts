/**
 * @fileoverview AudioGenerationService — Google Cloud TTS integration for Lumira.
 *
 * Converts insight texts and spiritual path synthesis into meditative audio
 * using Google Cloud Text-to-Speech (Neural2/Journey voices) with SSML formatting.
 *
 * Audio files are uploaded to S3 and URLs stored in the database.
 *
 * @module services/factory/AudioGenerationService
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AudioScriptService } from './AudioScriptService';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { AudioVoice, Prisma } from '@prisma/client';

const VOICE_MAP: Record<AudioVoice, string> = {
  FEMININE: 'fr-FR-Neural2-A',
  MASCULINE: 'fr-FR-Neural2-D',
};

const JOURNEY_VOICE_MAP: Record<AudioVoice, string> = {
  FEMININE: 'fr-FR-Journey-F',
  MASCULINE: 'fr-FR-Journey-D',
};

interface ManagedProductionState {
  type?: string;
  status?: string;
  stage?: string;
}

@Injectable()
export class AudioGenerationService {
  private readonly logger = new Logger(AudioGenerationService.name);
  private readonly ttsClient: TextToSpeechClient;
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;
  private readonly useJourneyVoices: boolean;
  private readonly allowLegacyFireAndForget: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly audioScriptService?: AudioScriptService,
  ) {
    const keyJson = this.configService.get<string>('GOOGLE_CLOUD_TTS_KEY_JSON');
    if (keyJson) {
      const credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf-8'));
      this.ttsClient = new TextToSpeechClient({ credentials });
    } else {
      this.ttsClient = new TextToSpeechClient();
    }

    const s3Region = this.configService.get<string>('AWS_REGION', 'eu-west-3');
    this.s3Bucket = this.configService.get<string>(
      'AWS_S3_BUCKET_NAME',
      this.configService.get<string>('AWS_LECTURES_BUCKET_NAME', 'oracle-lumira-lectures'),
    );
    this.s3Client = new S3Client({
      region: s3Region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });

    this.useJourneyVoices =
      this.configService.get<string>('TTS_USE_JOURNEY_VOICES', 'false') === 'true';
    this.allowLegacyFireAndForget =
      this.configService.get<string>('AUDIO_ALLOW_LEGACY_FIRE_AND_FORGET', 'false') === 'true';
  }

  /**
   * Generate audio for all insights and the global synthesis.
   *
   * By default the method only executes while the Desk production worker owns
   * a RUNNING AUDIO_GENERATION job. This prevents the historical post-PDF
   * fire-and-forget call from creating invisible work outside the control
   * center. Set AUDIO_ALLOW_LEGACY_FIRE_AND_FORGET=true only for rollback.
   */
  async generateAllAudio(orderId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { user: { include: { profile: true } } },
      });

      if (!order) {
        this.logger.error(`Order not found: ${orderId}`);
        return;
      }

      const production = this.readProductionState(order.expertReview);
      const isManagedAudioJob =
        production?.type === 'AUDIO_GENERATION' && production.status === 'RUNNING';
      if (!isManagedAudioJob && !this.allowLegacyFireAndForget) {
        this.logger.warn(
          `Audio generation ignored for ${order.orderNumber}: no managed RUNNING audio job`,
        );
        return;
      }

      const voice = order.user.profile?.preferredVoice ?? AudioVoice.FEMININE;
      this.logger.log(
        `🎙️ Starting managed audio generation for order ${order.orderNumber} (voice: ${voice})`,
      );

      const insights = await this.prisma.insight.findMany({
        where: { userId: order.userId },
        orderBy: { category: 'asc' },
      });

      if (insights.length > 0) {
        const batchSize = 3;
        for (let i = 0; i < insights.length; i += batchSize) {
          const batch = insights.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (insight) => {
              try {
                const scriptText = await this.reformulateText(
                  insight.full,
                  'insight',
                  insight.category,
                );
                const audioUrl = await this.generateAndUploadAudio(
                  scriptText,
                  voice,
                  `audio/insights/${order.orderNumber}/${insight.category.toLowerCase()}.mp3`,
                );

                await this.prisma.insight.update({
                  where: { id: insight.id },
                  data: { audioUrl },
                });

                this.logger.log(`  ✅ Insight ${insight.category} audio ready`);
              } catch (error) {
                this.logger.error(
                  `  ❌ Insight ${insight.category} audio failed: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              }
            }),
          );
        }
      }

      const spiritualPath = await this.prisma.spiritualPath.findUnique({
        where: { userId: order.userId },
      });

      if (!spiritualPath?.synthesis) {
        throw new Error('Aucune synthèse validée n’est disponible pour produire l’audio principal');
      }

      const synthesisScript = await this.reformulateText(spiritualPath.synthesis, 'synthesis');
      const synthesisAudioUrl = await this.generateAndUploadAudio(
        synthesisScript,
        voice,
        `audio/synthesis/${order.orderNumber}/synthesis.mp3`,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.orderFile.deleteMany({
          where: {
            orderId: order.id,
            type: 'AUDIO_READING',
          },
        });

        await tx.orderFile.create({
          data: {
            orderId: order.id,
            name: `Synthèse Audio - ${order.orderNumber}`,
            url: synthesisAudioUrl,
            key: `audio/synthesis/${order.orderNumber}/synthesis.mp3`,
            contentType: 'audio/mpeg',
            size: 0,
            type: 'AUDIO_READING',
          },
        });
      });

      const elapsed = Date.now() - startTime;
      this.logger.log(`🎙️ Audio generation complete for ${order.orderNumber} in ${elapsed}ms`);
    } catch (error) {
      this.logger.error(
        `💥 Audio generation failed for order ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private readProductionState(value: Prisma.JsonValue | null): ManagedProductionState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const production = (value as Record<string, unknown>).production;
    if (!production || typeof production !== 'object' || Array.isArray(production)) return null;
    return production as ManagedProductionState;
  }

  private textToSsml(text: string): string {
    const ssml = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n\n+/g, '<break time="900ms"/>')
      .replace(/\n/g, '<break time="400ms"/>')
      .replace(/\.{3}/g, '<break time="600ms"/>')
      .replace(/—/g, '<break time="300ms"/>');

    return `<speak>${ssml}</speak>`;
  }

  private async synthesize(text: string, voice: AudioVoice): Promise<Buffer> {
    const ssml = this.textToSsml(text);
    const voiceMap = this.useJourneyVoices ? JOURNEY_VOICE_MAP : VOICE_MAP;
    const voiceName = voiceMap[voice];

    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { ssml },
      voice: {
        languageCode: 'fr-FR',
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'MP3' as unknown as protos.google.cloud.texttospeech.v1.AudioEncoding,
        speakingRate: 0.92,
        pitch: -1.0,
        volumeGainDb: 0.0,
      },
    };

    const [response] = await this.ttsClient.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('Google TTS returned empty audio content');
    }

    return Buffer.from(response.audioContent as Uint8Array);
  }

  private async reformulateText(
    text: string,
    type: 'synthesis' | 'insight',
    category?: string,
  ): Promise<string> {
    if (!this.audioScriptService) return text;
    return this.audioScriptService.reformulate({ text, type, category });
  }

  private async generateAndUploadAudio(
    text: string,
    voice: AudioVoice,
    s3Key: string,
  ): Promise<string> {
    const audioBuffer = await this.synthesize(text, voice);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
      }),
    );

    return `/api/readings/audio/${s3Key}`;
  }
}
