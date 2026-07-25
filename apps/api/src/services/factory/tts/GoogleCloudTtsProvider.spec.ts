import { ConfigService } from '@nestjs/config';
import { AudioVoice } from '@prisma/client';
import { GoogleCloudTtsProvider } from './GoogleCloudTtsProvider';

const mockSynthesizeSpeech = jest.fn();

jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: mockSynthesizeSpeech,
  })),
  protos: {},
}));

describe('GoogleCloudTtsProvider', () => {
  let provider: GoogleCloudTtsProvider;
  let configMap: Record<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    configMap = {
      TTS_USE_JOURNEY_VOICES: 'true',
      TTS_SPEAKING_RATE: '0.96',
      TTS_PITCH: '0',
      TTS_PARAGRAPH_BREAK_MS: '600',
      TTS_LINE_BREAK_MS: '250',
    };

    const configService = {
      get: jest.fn((key: string, fallback?: string) => configMap[key] ?? fallback),
    } as unknown as ConfigService;

    provider = new GoogleCloudTtsProvider(configService);
    mockSynthesizeSpeech.mockResolvedValue([{ audioContent: Buffer.from([1, 2, 3, 4]) }]);
  });

  it('resolves Journey voices when TTS_USE_JOURNEY_VOICES is true', () => {
    expect(provider.resolveVoice(AudioVoice.FEMININE)).toBe('fr-FR-Journey-F');
    expect(provider.resolveVoice(AudioVoice.MASCULINE)).toBe('fr-FR-Journey-D');
  });

  it('resolves Neural2 voices when TTS_USE_JOURNEY_VOICES is false', () => {
    configMap.TTS_USE_JOURNEY_VOICES = 'false';
    expect(provider.resolveVoice(AudioVoice.FEMININE)).toBe('fr-FR-Neural2-A');
    expect(provider.resolveVoice(AudioVoice.MASCULINE)).toBe('fr-FR-Neural2-D');
  });

  it('builds SSML with configurable break times', () => {
    const ssml = provider.textToSsml('Ligne 1\n\nLigne 2\nLigne 3', 600, 250);
    expect(ssml).toBe(
      '<speak>Ligne 1<break time="600ms"/>Ligne 2<break time="250ms"/>Ligne 3</speak>',
    );
  });

  it('synthesizes narration and returns AudioProviderResult', async () => {
    const result = await provider.synthesizeNarration({
      text: 'Bonjour, voici la lecture.',
      voice: AudioVoice.FEMININE,
      orderId: 'order-1',
      orderNumber: 'LUM-100',
    });

    expect(result.provider).toBe('google_cloud');
    expect(result.model).toBe('fr-FR-Journey-F');
    expect(result.buffer).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(mockSynthesizeSpeech.mock.calls[0][0].audioConfig.speakingRate).toBe(0.96);
  });
});
