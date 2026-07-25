import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AudioVoice } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { spawn } from 'child_process';
import {
  AudioProviderParams,
  AudioProviderResult,
  AudioTtsProvider,
} from './audio-tts.provider.interface';
import { buildLumiraTtsPrompt } from './gemini-tts-prompt.builder';

const DEFAULT_VOICES: Record<AudioVoice, string> = {
  FEMININE: 'Gacrux',
  MASCULINE: 'Iapetus',
};

@Injectable()
export class GeminiTtsProvider implements AudioTtsProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiTtsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async synthesizeNarration(params: AudioProviderParams): Promise<AudioProviderResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY non configurée pour GeminiTtsProvider');
    }

    const client = new GoogleGenAI({
      apiKey,
      vertexai: false,
    });

    const model =
      this.configService.get<string>('GEMINI_TTS_MODEL') || 'gemini-3.1-flash-tts-preview';
    const voice = this.resolveVoice(params.voice);

    const maxCharacters = this.readPositiveInt('AUDIO_TTS_CHUNK_CHARACTERS', 2800);
    const timeoutMs = this.readPositiveInt('GEMINI_TTS_TIMEOUT_MS', 180000);
    const maxAttempts = this.readPositiveInt('GEMINI_TTS_MAX_ATTEMPTS', 2);

    const sampleRate = this.readPositiveInt('GEMINI_TTS_SAMPLE_RATE', 24000);
    const channels = this.readPositiveInt('GEMINI_TTS_CHANNELS', 1);
    const sampleWidthBytes = this.readPositiveInt('GEMINI_TTS_SAMPLE_WIDTH_BYTES', 2);

    const cleanedText = this.cleanTranscriptForGemini(params.text);
    if (!cleanedText) {
      throw new Error('Transcript nettoyé vide pour la narration audio Gemini');
    }

    const chunks = this.splitIntoChunks(cleanedText, maxCharacters);
    this.logger.log(
      `Audio generation started: orderNumber=${params.orderNumber}, provider=gemini, model=${model}, voice=${voice}, chunkCount=${chunks.length}`,
    );

    const startTime = Date.now();
    const pcmBuffers: Buffer[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkStartTime = Date.now();
      const chunkText = chunks[index];
      const prompt = buildLumiraTtsPrompt({
        transcript: chunkText,
        chunkIndex: index + 1,
        totalChunks: chunks.length,
      });

      const pcmBuffer = await this.synthesizeChunkWithRetry({
        client,
        model,
        voice,
        prompt,
        chunkIndex: index + 1,
        totalChunks: chunks.length,
        orderNumber: params.orderNumber,
        timeoutMs,
        maxAttempts,
        sampleRate,
        channels,
        sampleWidthBytes,
      });

      pcmBuffers.push(pcmBuffer);
      this.logger.log(
        `Chunk progress: orderNumber=${params.orderNumber}, provider=gemini, chunk=${index + 1}/${chunks.length}, elapsedMs=${Date.now() - chunkStartTime}`,
      );
    }

    const fullPcmBuffer = Buffer.concat(pcmBuffers);
    const bytesPerSecond = sampleRate * channels * sampleWidthBytes;
    const estimatedDurationSeconds = fullPcmBuffer.length / bytesPerSecond;

    const mp3Buffer = await this.encodePcmToMp3(fullPcmBuffer, {
      sampleRate,
      channels,
      bitrateKbps: this.configService.get<string>('GEMINI_TTS_MP3_BITRATE_KBPS', '96k'),
      loudnessI: this.configService.get<string>('GEMINI_TTS_LOUDNESS_I', '-16'),
      truePeak: this.configService.get<string>('GEMINI_TTS_TRUE_PEAK', '-1.5'),
      loudnessRange: this.configService.get<string>('GEMINI_TTS_LOUDNESS_RANGE', '11'),
    });

    this.logger.log(
      `Audio generation completed: orderNumber=${params.orderNumber}, provider=gemini, model=${model}, voice=${voice}, outputSize=${mp3Buffer.length}, estimatedDuration=${Math.round(estimatedDurationSeconds)}s, elapsedMs=${Date.now() - startTime}`,
    );

    return {
      buffer: mp3Buffer,
      contentType: 'audio/mpeg',
      extension: 'mp3',
      provider: 'gemini',
      model,
      voice,
      chunkCount: chunks.length,
      estimatedDurationSeconds,
    };
  }

  resolveVoice(voice: AudioVoice): string {
    if (voice === AudioVoice.MASCULINE) {
      return (
        this.configService.get<string>('GEMINI_TTS_VOICE_MASCULINE') || DEFAULT_VOICES.MASCULINE
      );
    }
    return this.configService.get<string>('GEMINI_TTS_VOICE_FEMININE') || DEFAULT_VOICES.FEMININE;
  }

  cleanTranscriptForGemini(text: string): string {
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
      .replace(/<[^>]*>/g, '') // Strips any legacy HTML/SSML tags (<speak>, <break>, etc.)
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  splitIntoChunks(text: string, maxCharacters: number): string[] {
    const paragraphs = text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const rawChunks: string[] = [];
    let current = '';

    const push = (val: string) => {
      const normalized = val.trim();
      if (normalized) rawChunks.push(normalized);
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

    const mergedChunks: string[] = [];
    for (let i = 0; i < rawChunks.length; i += 1) {
      const chunk = rawChunks[i];
      if (chunk.length < 300 && i > 0) {
        const prev = mergedChunks[mergedChunks.length - 1];
        if (prev && prev.length + 2 + chunk.length <= maxCharacters) {
          mergedChunks[mergedChunks.length - 1] = `${prev}\n\n${chunk}`;
          continue;
        }
      }
      mergedChunks.push(chunk);
    }

    return mergedChunks.length > 0 ? mergedChunks : [text.slice(0, maxCharacters)];
  }

  private async synthesizeChunkWithRetry(params: {
    client: GoogleGenAI;
    model: string;
    voice: string;
    prompt: string;
    chunkIndex: number;
    totalChunks: number;
    orderNumber: string;
    timeoutMs: number;
    maxAttempts: number;
    sampleRate: number;
    channels: number;
    sampleWidthBytes: number;
  }): Promise<Buffer> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < params.maxAttempts) {
      attempt += 1;
      try {
        const response = await this.callGeminiApiWithTimeout(
          params.client,
          params.model,
          params.voice,
          params.prompt,
          params.timeoutMs,
        );

        const pcmBuffer = this.extractAndValidatePcm(response, {
          sampleRate: params.sampleRate,
          channels: params.channels,
          sampleWidthBytes: params.sampleWidthBytes,
        });

        return pcmBuffer;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRetryable = this.isRetryableError(lastError);

        this.logger.warn(
          `Primary provider failed: orderNumber=${params.orderNumber}, provider=gemini, chunk=${params.chunkIndex}/${params.totalChunks}, attempt=${attempt}/${params.maxAttempts}, retryable=${isRetryable}, error=${lastError.message}`,
        );

        if (!isRetryable || attempt >= params.maxAttempts) {
          throw lastError;
        }

        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 200, 5000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError || new Error('Gemini TTS chunk synthesis failed after retries');
  }

  private async callGeminiApiWithTimeout(
    client: GoogleGenAI,
    model: string,
    voice: string,
    prompt: string,
    timeoutMs: number,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Gemini TTS API call timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      const apiPromise = client.interactions.create({
        model,
        input: prompt,
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [
            {
              voice,
            },
          ],
        },
      } as never);

      return await Promise.race([apiPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  extractAndValidatePcm(
    response: unknown,
    params: { sampleRate: number; channels: number; sampleWidthBytes: number },
  ): Buffer {
    if (!response || typeof response !== 'object') {
      throw new Error('Réponse Gemini TTS invalide (non-objet)');
    }

    const base64Data = this.extractAudioBase64(response as Record<string, unknown>);
    if (!base64Data) {
      throw new Error('Réponse Gemini TTS sans données audio');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch {
      throw new Error('Impossible de décoder le base64 audio de Gemini TTS');
    }

    if (buffer.length === 0) {
      throw new Error('Buffer audio Gemini PCM vide');
    }

    if (buffer.length % params.sampleWidthBytes !== 0) {
      throw new Error('Taille du buffer PCM impaire pour du PCM 16 bits');
    }

    const bytesPerSecond = params.sampleRate * params.channels * params.sampleWidthBytes;
    const durationSeconds = buffer.length / bytesPerSecond;

    if (durationSeconds < 0.25) {
      throw new Error(
        `Durée du chunk PCM inférieure à 250ms (${Math.round(durationSeconds * 1000)}ms)`,
      );
    }

    if (durationSeconds > 1200) {
      throw new Error(`Durée du chunk PCM trop grande (${Math.round(durationSeconds)}s)`);
    }

    return buffer;
  }

  private extractAudioBase64(response: Record<string, unknown>): string | null {
    if (typeof response.output_audio === 'string') return response.output_audio;
    if (
      response.output_audio &&
      typeof response.output_audio === 'object' &&
      typeof (response.output_audio as Record<string, unknown>).data === 'string'
    ) {
      return (response.output_audio as Record<string, unknown>).data as string;
    }

    if (typeof response.audio === 'string') return response.audio;
    if (
      response.audio &&
      typeof response.audio === 'object' &&
      typeof (response.audio as Record<string, unknown>).data === 'string'
    ) {
      return (response.audio as Record<string, unknown>).data as string;
    }

    if (Array.isArray(response.outputs) && response.outputs.length > 0) {
      const first = response.outputs[0] as Record<string, unknown> | undefined;
      if (typeof first?.data === 'string') return first.data;
      if (
        first?.inline_data &&
        typeof first.inline_data === 'object' &&
        typeof (first.inline_data as Record<string, unknown>).data === 'string'
      ) {
        return (first.inline_data as Record<string, unknown>).data as string;
      }
      if (
        first?.audio &&
        typeof first.audio === 'object' &&
        typeof (first.audio as Record<string, unknown>).data === 'string'
      ) {
        return (first.audio as Record<string, unknown>).data as string;
      }
    }

    if (Array.isArray(response.candidates) && response.candidates.length > 0) {
      const candidate = response.candidates[0] as Record<string, unknown> | undefined;
      const content = candidate?.content as Record<string, unknown> | undefined;
      const parts = content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (!part || typeof part !== 'object') continue;
          const p = part as Record<string, unknown>;
          if (
            p.inlineData &&
            typeof p.inlineData === 'object' &&
            typeof (p.inlineData as Record<string, unknown>).data === 'string'
          ) {
            return (p.inlineData as Record<string, unknown>).data as string;
          }
          if (
            p.inline_data &&
            typeof p.inline_data === 'object' &&
            typeof (p.inline_data as Record<string, unknown>).data === 'string'
          ) {
            return (p.inline_data as Record<string, unknown>).data as string;
          }
          if (
            p.audio &&
            typeof p.audio === 'object' &&
            typeof (p.audio as Record<string, unknown>).data === 'string'
          ) {
            return (p.audio as Record<string, unknown>).data as string;
          }
        }
      }
    }

    return null;
  }

  isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    if (
      message.includes('key') ||
      message.includes('api_key') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('404')
    ) {
      if (!message.includes('timeout')) {
        return false;
      }
    }

    return (
      message.includes('timeout') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('fetch failed') ||
      message.includes('vide') ||
      message.includes('sans données')
    );
  }

  private encodePcmToMp3(
    pcmBuffer: Buffer,
    options: {
      sampleRate: number;
      channels: number;
      bitrateKbps: string;
      loudnessI: string;
      truePeak: string;
      loudnessRange: string;
    },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-f',
        's16le',
        '-ar',
        String(options.sampleRate),
        '-ac',
        String(options.channels),
        '-i',
        'pipe:0',
        '-af',
        `loudnorm=I=${options.loudnessI}:TP=${options.truePeak}:LRA=${options.loudnessRange}`,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        options.bitrateKbps,
        '-f',
        'mp3',
        'pipe:1',
      ];

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: Buffer[] = [];
      let stderrText = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        ffmpegProcess.kill('SIGKILL');
        reject(new Error('FFmpeg conversion timed out after 60s'));
      }, 60000);

      ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });

      ffmpegProcess.stderr.on('data', (chunk: Buffer) => {
        stderrText += chunk.toString('utf-8');
      });

      ffmpegProcess.on('error', (err) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`FFmpeg launch error: ${err.message}`));
        }
      });

      ffmpegProcess.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (code !== 0) {
          const detail = stderrText.trim() ? `: ${stderrText.trim()}` : '';
          this.logger.error(`FFmpeg failed with exit code ${code}${detail}`);
          reject(new Error(`FFmpeg failed with exit code ${code}`));
          return;
        }

        const mp3Result = Buffer.concat(stdoutChunks);
        if (mp3Result.length === 0) {
          reject(new Error('FFmpeg generated 0 bytes MP3 output'));
          return;
        }

        resolve(mp3Result);
      });

      ffmpegProcess.stdin.write(pcmBuffer);
      ffmpegProcess.stdin.end();
    });
  }

  private readPositiveInt(key: string, fallback: number): number {
    const val = Number(this.configService.get<string>(key));
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : fallback;
  }
}
