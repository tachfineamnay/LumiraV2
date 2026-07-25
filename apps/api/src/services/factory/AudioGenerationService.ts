/**
 * Multi-provider TTS orchestration for private Lumira reading audio.
 *
 * The full audio is generated from the immutable SEALED ReadingVersion. The
 * Desk production worker must own a RUNNING AUDIO_GENERATION job, unless the
 * explicit rollback switch enables the historical fire-and-forget behavior.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AudioVoice, Prisma } from '@prisma/client';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CanonicalReadingContent,
  isCanonicalReadingContent,
} from '../../modules/expert/reading-version';
import { AudioScriptService } from './AudioScriptService';
import { GeminiTtsProvider } from './tts/GeminiTtsProvider';
import { GoogleCloudTtsProvider } from './tts/GoogleCloudTtsProvider';
import { AudioProviderResult, AudioTtsProvider } from './tts/audio-tts.provider.interface';

const ALLOWED_PROVIDERS = ['gemini', 'google_cloud'] as const;
type TtsProviderType = (typeof ALLOWED_PROVIDERS)[number];

interface ManagedProductionState {
  type?: string;
  status?: string;
  stage?: string;
}

export interface AudioGenerationResult {
  fileId: string;
  storageKey: string;
  readingVersionId: string;
  contentHash: string;
  size: number;
  provider: string;
  model: string;
  voice: string;
}

@Injectable()
export class AudioGenerationService {
  private readonly logger = new Logger(AudioGenerationService.name);
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;
  private readonly allowLegacyFireAndForget: boolean;
  private readonly generateInsightAudio: boolean;

  private readonly primaryProviderName: TtsProviderType;
  private readonly fallbackProviderName: TtsProviderType;
  private readonly fallbackEnabled: boolean;
  private readonly allowMixedProviders: boolean;
  private readonly keepExistingOnFailure: boolean;

  private readonly geminiProvider: GeminiTtsProvider;
  private readonly googleCloudProvider: GoogleCloudTtsProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly audioScriptService?: AudioScriptService,
    @Optional() geminiTtsProvider?: GeminiTtsProvider,
    @Optional() googleCloudTtsProvider?: GoogleCloudTtsProvider,
  ) {
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

    this.allowLegacyFireAndForget =
      this.configService.get<string>('AUDIO_ALLOW_LEGACY_FIRE_AND_FORGET', 'false') === 'true';
    this.generateInsightAudio =
      this.configService.get<string>('AUDIO_GENERATE_INSIGHTS', 'false') === 'true';

    this.primaryProviderName = this.parseProviderConfig('AUDIO_TTS_PROVIDER', 'gemini');
    this.fallbackProviderName = this.parseProviderConfig(
      'AUDIO_TTS_FALLBACK_PROVIDER',
      'google_cloud',
    );

    this.fallbackEnabled =
      this.configService.get<string>('AUDIO_TTS_FALLBACK_ENABLED', 'true') === 'true';
    this.allowMixedProviders =
      this.configService.get<string>('AUDIO_TTS_ALLOW_MIXED_PROVIDERS', 'false') === 'true';
    this.keepExistingOnFailure =
      this.configService.get<string>('AUDIO_TTS_KEEP_EXISTING_ON_FAILURE', 'true') === 'true';

    this.geminiProvider = geminiTtsProvider || new GeminiTtsProvider(this.configService);
    this.googleCloudProvider =
      googleCloudTtsProvider || new GoogleCloudTtsProvider(this.configService);
  }

  async generateAllAudio(orderId: string): Promise<AudioGenerationResult | null> {
    const startTime = Date.now();
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { include: { profile: true } },
        readingVersions: {
          where: { status: 'SEALED' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) throw new Error(`Order not found: ${orderId}`);

    const production = this.readProductionState(order.expertReview);
    const isManagedAudioJob =
      production?.type === 'AUDIO_GENERATION' && production.status === 'RUNNING';
    if (!isManagedAudioJob && !this.allowLegacyFireAndForget) {
      this.logger.log(
        `Audio generation skipped for ${order.orderNumber}: no managed RUNNING audio job`,
      );
      return null;
    }

    const sealedVersion = order.readingVersions[0];
    if (!sealedVersion || !isCanonicalReadingContent(sealedVersion.content)) {
      throw new Error('Aucune version scellée et valide n’est disponible pour la narration');
    }

    const voice = order.user.profile?.preferredVoice ?? AudioVoice.FEMININE;
    const sourceNarration = this.buildNarration(sealedVersion.content);
    if (sourceNarration.length < 50) {
      throw new Error('Le contenu scellé est trop court pour produire une narration');
    }

    const narration = this.audioScriptService
      ? await this.audioScriptService.reformulate({
          text: sourceNarration,
          type: 'synthesis',
          orderId: order.id,
        })
      : sourceNarration;

    const primaryProvider = this.getProviderInstance(this.primaryProviderName);
    let synthResult: AudioProviderResult | null = null;

    try {
      this.logger.log(
        `🎙️ Generating sealed reading audio for ${order.orderNumber} ` +
          `(version=${sealedVersion.version}, voice=${voice}, provider=${this.primaryProviderName})`,
      );

      synthResult = await primaryProvider.synthesizeNarration({
        text: narration,
        voice,
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    } catch (primaryError) {
      const errorMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      this.logger.warn(
        `Primary provider failed: orderNumber=${order.orderNumber}, provider=${this.primaryProviderName}, error=${errorMsg}`,
      );

      if (!this.fallbackEnabled) {
        this.logger.error(`Fallback disabled. Audio generation failed for ${order.orderNumber}`);
        throw primaryError;
      }

      this.logger.log(
        `Fallback started: orderNumber=${order.orderNumber}, fallbackProvider=${this.fallbackProviderName}`,
      );

      try {
        const fallbackProvider = this.getProviderInstance(this.fallbackProviderName);
        synthResult = await fallbackProvider.synthesizeNarration({
          text: narration,
          voice,
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      } catch (fallbackError) {
        this.logger.error(
          `Fallback provider failed for ${order.orderNumber}: ${
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          }`,
        );
        throw fallbackError;
      }
    }

    if (!synthResult || synthResult.buffer.length === 0) {
      throw new Error('Résultat audio final vide ou invalide');
    }

    const hashPrefix = sealedVersion.contentHash.slice(0, 16);
    const normalizedModel = synthResult.model.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedVoice = synthResult.voice.toLowerCase().replace(/[^a-z0-9]/g, '');
    const storageKey =
      `audio/readings/${order.orderNumber}/` +
      `v${sealedVersion.version}-${hashPrefix}-${synthResult.provider}-${normalizedModel}-${normalizedVoice}-lecture-complete.mp3`;

    const audioUrl = await this.uploadAudio(synthResult.buffer, storageKey, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      readingVersionId: sealedVersion.id,
      contentHash: sealedVersion.contentHash,
      ttsProvider: synthResult.provider,
      ttsModel: synthResult.model,
      ttsVoice: synthResult.voice,
      chunkCount: String(synthResult.chunkCount),
      generatedAt: new Date().toISOString(),
    });

    const file = await this.prisma.$transaction(async (tx) => {
      await tx.orderFile.deleteMany({
        where: { orderId: order.id, type: 'AUDIO_READING' },
      });
      return tx.orderFile.create({
        data: {
          orderId: order.id,
          name: `Lecture audio complète - ${order.orderNumber}`,
          url: audioUrl,
          key: storageKey,
          contentType: synthResult.contentType,
          size: synthResult.buffer.length,
          type: 'AUDIO_READING',
        },
      });
    });

    if (this.generateInsightAudio) {
      await this.generateOptionalInsightAudio(order.userId, order.orderNumber, voice);
    }

    this.logger.log(
      `🎙️ Sealed reading audio ready for ${order.orderNumber} ` +
        `(${Math.round(synthResult.buffer.length / 1024)}KB, ${Date.now() - startTime}ms, provider=${synthResult.provider})`,
    );

    return {
      fileId: file.id,
      storageKey,
      readingVersionId: sealedVersion.id,
      contentHash: sealedVersion.contentHash,
      size: synthResult.buffer.length,
      provider: synthResult.provider,
      model: synthResult.model,
      voice: synthResult.voice,
    };
  }

  private parseProviderConfig(key: string, fallback: TtsProviderType): TtsProviderType {
    const raw = (this.configService.get<string>(key) || fallback).trim().toLowerCase();
    if (ALLOWED_PROVIDERS.includes(raw as TtsProviderType)) {
      return raw as TtsProviderType;
    }
    throw new Error(
      `Configuration invalide pour ${key}: "${raw}". Valeurs autorisées: ${ALLOWED_PROVIDERS.join(', ')}`,
    );
  }

  private getProviderInstance(name: TtsProviderType): AudioTtsProvider {
    if (name === 'gemini') return this.geminiProvider;
    if (name === 'google_cloud') return this.googleCloudProvider;
    throw new Error(`Provider inconnu: ${name}`);
  }

  private buildNarration(content: CanonicalReadingContent): string {
    const exactStudioText = this.normalizeNarrationText(content.lecture);
    if (exactStudioText.length >= 50) return exactStudioText;

    const pdf = content.pdf_content;
    const blocks = [
      pdf.introduction,
      pdf.archetype_reveal,
      ...pdf.sections.flatMap((section) => [section.title, section.content]),
      ...pdf.karmic_insights,
      pdf.life_mission,
      pdf.conclusion,
    ];
    return this.normalizeNarrationText(blocks.filter(Boolean).join('\n\n'));
  }

  private normalizeNarrationText(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+[.)]\s+/gm, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async uploadAudio(
    audioBuffer: Buffer,
    storageKey: string,
    metadata: Record<string, string>,
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: storageKey,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        Metadata: metadata,
      }),
    );
    return `/api/readings/audio/${storageKey}`;
  }

  private async generateOptionalInsightAudio(
    userId: string,
    orderNumber: string,
    voice: AudioVoice,
  ) {
    const insights = await this.prisma.insight.findMany({
      where: { userId },
      orderBy: { category: 'asc' },
    });
    for (const insight of insights) {
      try {
        const script = this.audioScriptService
          ? await this.audioScriptService.reformulate({
              text: insight.full,
              type: 'insight',
              category: insight.category,
            })
          : insight.full;
        const provider = this.getProviderInstance(this.primaryProviderName);
        const synthResult = await provider.synthesizeNarration({
          text: script,
          voice,
          orderId: 'insight',
          orderNumber,
        });

        const key = `audio/insights/${orderNumber}/${insight.category.toLowerCase()}.mp3`;
        const url = await this.uploadAudio(synthResult.buffer, key, {
          orderNumber,
          category: insight.category,
          ttsProvider: synthResult.provider,
        });
        await this.prisma.insight.update({ where: { id: insight.id }, data: { audioUrl: url } });
      } catch (error) {
        this.logger.error(
          `Insight ${insight.category} audio failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private readProductionState(value: Prisma.JsonValue | null): ManagedProductionState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const production = (value as Record<string, unknown>).production;
    if (!production || typeof production !== 'object' || Array.isArray(production)) return null;
    return production as ManagedProductionState;
  }
}
