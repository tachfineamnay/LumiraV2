import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AudioVoice } from '@prisma/client';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import {
  AudioProviderParams,
  AudioProviderResult,
  AudioTtsProvider,
} from './audio-tts.provider.interface';

const NEURAL2_VOICE_MAP: Record<AudioVoice, string> = {
  FEMININE: 'fr-FR-Neural2-A',
  MASCULINE: 'fr-FR-Neural2-D',
};

const JOURNEY_VOICE_MAP: Record<AudioVoice, string> = {
  FEMININE: 'fr-FR-Journey-F',
  MASCULINE: 'fr-FR-Journey-D',
};

@Injectable()
export class GoogleCloudTtsProvider implements AudioTtsProvider {
  readonly name = 'google_cloud';
  private readonly logger = new Logger(GoogleCloudTtsProvider.name);
  private readonly ttsClient: TextToSpeechClient;

  constructor(private readonly configService: ConfigService) {
    const keyJson = this.configService.get<string>('GOOGLE_CLOUD_TTS_KEY_JSON');
    if (keyJson) {
      const credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf-8'));
      this.ttsClient = new TextToSpeechClient({ credentials });
    } else {
      this.ttsClient = new TextToSpeechClient();
    }
  }

  async synthesizeNarration(params: AudioProviderParams): Promise<AudioProviderResult> {
    const voice = this.resolveVoice(params.voice);
    const maxCharacters = this.readPositiveInt('AUDIO_TTS_CHUNK_CHARACTERS', 3500);

    const speakingRate = this.readClampedFloat('TTS_SPEAKING_RATE', 0.96, 0.75, 1.25);
    const pitch = this.readClampedFloat('TTS_PITCH', 0.0, -5.0, 5.0);
    const paragraphBreakMs = this.readClampedInt('TTS_PARAGRAPH_BREAK_MS', 600, 0, 2000);
    const lineBreakMs = this.readClampedInt('TTS_LINE_BREAK_MS', 250, 0, 2000);

    const chunks = this.splitIntoChunks(params.text, maxCharacters);
    this.logger.log(
      `Audio generation started: orderNumber=${params.orderNumber}, provider=google_cloud, model=${voice}, voice=${voice}, chunkCount=${chunks.length}`,
    );

    const startTime = Date.now();
    const mp3Buffers: Buffer[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkStartTime = Date.now();
      const chunkText = chunks[index];
      const ssml = this.textToSsml(chunkText, paragraphBreakMs, lineBreakMs);

      const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { ssml },
        voice: { languageCode: 'fr-FR', name: voice },
        audioConfig: {
          audioEncoding: 'MP3' as unknown as protos.google.cloud.texttospeech.v1.AudioEncoding,
          speakingRate,
          pitch,
          volumeGainDb: 0.0,
        },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);
      if (!response.audioContent) {
        throw new Error(`Google TTS empty audio response for chunk ${index + 1}/${chunks.length}`);
      }

      const buffer = Buffer.from(response.audioContent as Uint8Array);
      mp3Buffers.push(buffer);

      this.logger.log(
        `Chunk progress: orderNumber=${params.orderNumber}, provider=google_cloud, chunk=${index + 1}/${chunks.length}, elapsedMs=${Date.now() - chunkStartTime}`,
      );
    }

    const fullMp3Buffer = Buffer.concat(mp3Buffers);
    // Rough estimation based on ~12KB/s for 96kbps MP3
    const estimatedDurationSeconds = Math.round(fullMp3Buffer.length / 12000);

    this.logger.log(
      `Audio generation completed: orderNumber=${params.orderNumber}, provider=google_cloud, model=${voice}, voice=${voice}, outputSize=${fullMp3Buffer.length}, estimatedDuration=${estimatedDurationSeconds}s, elapsedMs=${Date.now() - startTime}`,
    );

    return {
      buffer: fullMp3Buffer,
      contentType: 'audio/mpeg',
      extension: 'mp3',
      provider: 'google_cloud',
      model: voice,
      voice,
      chunkCount: chunks.length,
      estimatedDurationSeconds,
    };
  }

  resolveVoice(voice: AudioVoice): string {
    const useJourney = this.configService.get<string>('TTS_USE_JOURNEY_VOICES', 'true') === 'true';
    const map = useJourney ? JOURNEY_VOICE_MAP : NEURAL2_VOICE_MAP;
    return map[voice] || map[AudioVoice.FEMININE];
  }

  textToSsml(text: string, paragraphBreakMs: number, lineBreakMs: number): string {
    const ssml = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n\n+/g, `<break time="${paragraphBreakMs}ms"/>`)
      .replace(/\n/g, `<break time="${lineBreakMs}ms"/>`)
      .replace(/\.{3}/g, `<break time="${Math.max(paragraphBreakMs, 500)}ms"/>`)
      .replace(/—/g, `<break time="${lineBreakMs}ms"/>`);
    return `<speak>${ssml}</speak>`;
  }

  splitIntoChunks(text: string, maxCharacters: number): string[] {
    const paragraphs = text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const chunks: string[] = [];
    let current = '';

    const push = (val: string) => {
      const normalized = val.trim();
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

  private readPositiveInt(key: string, fallback: number): number {
    const val = Number(this.configService.get<string>(key));
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : fallback;
  }

  private readClampedFloat(key: string, fallback: number, min: number, max: number): number {
    const val = Number(this.configService.get<string>(key));
    if (!Number.isFinite(val)) return fallback;
    return Math.max(min, Math.min(max, val));
  }

  private readClampedInt(key: string, fallback: number, min: number, max: number): number {
    const val = Number(this.configService.get<string>(key));
    if (!Number.isFinite(val)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(val)));
  }
}
