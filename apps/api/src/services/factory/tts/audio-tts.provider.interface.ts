import { AudioVoice } from '@prisma/client';

export interface AudioProviderParams {
  text: string;
  voice: AudioVoice;
  orderId: string;
  orderNumber: string;
}

export interface AudioProviderResult {
  buffer: Buffer;
  contentType: 'audio/mpeg';
  extension: 'mp3';
  provider: string;
  model: string;
  voice: string;
  chunkCount: number;
  estimatedDurationSeconds: number;
}

export interface AudioTtsProvider {
  readonly name: string;

  synthesizeNarration(params: AudioProviderParams): Promise<AudioProviderResult>;
}
