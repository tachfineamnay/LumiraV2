/**
 * Google Cloud TTS orchestration for private Lumira reading audio.
 *
 * The full audio is generated from the immutable SEALED ReadingVersion. The
 * Desk production worker must own a RUNNING AUDIO_GENERATION job, unless the
 * explicit rollback switch enables the historical fire-and-forget behavior.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AudioVoice, Prisma } from '@prisma/client';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CanonicalReadingContent,
  isCanonicalReadingContent,
} from '../../modules/expert/reading-version';
import { AudioScriptService } from './AudioScriptService';

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

export interface AudioGenerationResult {
  fileId: string;
  storageKey: string;
  readingVersionId: string;
  contentHash: string;
  size: number;
}

@Injectable()
export class AudioGenerationService {
  private readonly logger = new Logger(AudioGenerationService.name);
  private readonly ttsClient: TextToSpeechClient;
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;
  private readonly useJourneyVoices: boolean;
  private readonly allowLegacyFireAndForget: boolean;
  private readonly generateInsightAudio: boolean;
  private readonly maxChunkCharacters: number;

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
    this.generateInsightAudio =
      this.configService.get<string>('AUDIO_GENERATE_INSIGHTS', 'false') === 'true';
    this.maxChunkCharacters = this.readPositiveInt('AUDIO_TTS_CHUNK_CHARACTERS', 3500);
  }

  async generateAllAudio(orderId: string): Promise<AudioGenerationResult> {
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
      this.logger.warn(
        `Audio generation ignored for ${order.orderNumber}: no managed RUNNING audio job`,
      );
      throw new Error('Aucun job audio géré par le Desk n’est actif');
    }

    const sealedVersion = order.readingVersions[0];
    if (!sealedVersion || !isCanonicalReadingContent(sealedVersion.content)) {
      throw new Error('Aucune version scellée et valide n’est disponible pour la narration');
    }

    const voice = order.user.profile?.preferredVoice ?? AudioVoice.FEMININE;
    const narration = this.buildNarration(sealedVersion.content);
    if (narration.length < 50) {
      throw new Error('Le contenu scellé est trop court pour produire une narration');
    }

    this.logger.log(
      `🎙️ Generating sealed reading audio for ${order.orderNumber} ` +
        `(version=${sealedVersion.version}, voice=${voice})`,
    );

    const audioBuffer = await this.synthesizeLongText(narration, voice);
    const hashPrefix = sealedVersion.contentHash.slice(0, 16);
    const storageKey =
      `audio/readings/${order.orderNumber}/` +
      `v${sealedVersion.version}-${hashPrefix}-lecture-complete.mp3`;
    const audioUrl = await this.uploadAudio(audioBuffer, storageKey, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      readingVersionId: sealedVersion.id,
      contentHash: sealedVersion.contentHash,
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
          contentType: 'audio/mpeg',
          size: audioBuffer.length,
          type: 'AUDIO_READING',
        },
      });
    });

    if (this.generateInsightAudio) {
      await this.generateOptionalInsightAudio(order.userId, order.orderNumber, voice);
    }

    this.logger.log(
      `🎙️ Sealed reading audio ready for ${order.orderNumber} ` +
        `(${Math.round(audioBuffer.length / 1024)}KB, ${Date.now() - startTime}ms)`,
    );

    return {
      fileId: file.id,
      storageKey,
      readingVersionId: sealedVersion.id,
      contentHash: sealedVersion.contentHash,
      size: audioBuffer.length,
    };
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

  private async synthesizeLongText(text: string, voice: AudioVoice): Promise<Buffer> {
    const chunks = this.splitIntoChunks(text, this.maxChunkCharacters);
    this.logger.log(`🎙️ Narration split into ${chunks.length} TTS chunk(s)`);
    const buffers: Buffer[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      this.logger.log(`  🔊 TTS chunk ${index + 1}/${chunks.length}`);
      buffers.push(await this.synthesize(chunks[index], voice));
    }

    // MP3 is frame-based. Concatenating complete TTS MP3 responses preserves
    // sequential playback in modern browsers while avoiding an FFmpeg runtime
    // dependency in the API image.
    return Buffer.concat(buffers);
  }

  private splitIntoChunks(text: string, maxCharacters: number): string[] {
    const paragraphs = text.split(/\n\n+/).map((value) => value.trim()).filter(Boolean);
    const chunks: string[] = [];
    let current = '';

    const push = (value: string) => {
      const normalized = value.trim();
      if (normalized) chunks.push(normalized);
    };

    for (const paragraph of paragraphs) {
      if (paragraph.length <= maxCharacters) {
        const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
        if (candidate.length <= maxCharacters) {
          current = candidate;
        } else {
          push(current);
          current = paragraph;
        }
        continue;
      }

      push(current);
      current = '';
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk = '';
      for (const sentence of sentences) {
        if (sentence.length > maxCharacters) {
          push(sentenceChunk);
          sentenceChunk = '';
          for (let offset = 0; offset < sentence.length; offset += maxCharacters) {
            push(sentence.slice(offset, offset + maxCharacters));
          }
          continue;
        }
        const candidate = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
        if (candidate.length <= maxCharacters) sentenceChunk = candidate;
        else {
          push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }
      push(sentenceChunk);
    }
    push(current);

    return chunks.length > 0 ? chunks : [text.slice(0, maxCharacters)];
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
    const voiceMap = this.useJourneyVoices ? JOURNEY_VOICE_MAP : VOICE_MAP;
    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { ssml: this.textToSsml(text) },
      voice: { languageCode: 'fr-FR', name: voiceMap[voice] },
      audioConfig: {
        audioEncoding: 'MP3' as unknown as protos.google.cloud.texttospeech.v1.AudioEncoding,
        speakingRate: 0.92,
        pitch: -1.0,
        volumeGainDb: 0.0,
      },
    };
    const [response] = await this.ttsClient.synthesizeSpeech(request);
    if (!response.audioContent) throw new Error('Google TTS returned empty audio content');
    return Buffer.from(response.audioContent as Uint8Array);
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
        const key = `audio/insights/${orderNumber}/${insight.category.toLowerCase()}.mp3`;
        const buffer = await this.synthesizeLongText(script, voice);
        const url = await this.uploadAudio(buffer, key, {
          orderNumber,
          category: insight.category,
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

  private readPositiveInt(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
}
