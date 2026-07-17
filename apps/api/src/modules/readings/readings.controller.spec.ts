import { Readable } from 'stream';
import { ReadingsController } from './readings.controller';
import { ReadingsService } from './readings.service';

describe('ReadingsController', () => {
  const readingsService = {
    getAudioStream: jest.fn(),
    getPdfStream: jest.fn(),
    getPdfSignedUrl: jest.fn(),
  } as unknown as jest.Mocked<ReadingsService>;
  const controller = new ReadingsController(readingsService);

  beforeEach(() => jest.clearAllMocks());

  it('streams private audio only with the authenticated user and range', async () => {
    readingsService.getAudioStream.mockResolvedValue({
      stream: Readable.from(['audio']),
      contentType: 'audio/mpeg',
      contentLength: 5,
      contentRange: 'bytes 0-4/5',
    });
    const response = {
      setHeader: jest.fn(),
      status: jest.fn(),
    };

    await controller.streamAudio(
      'LUM-001',
      { user: { userId: 'client-1' } },
      'bytes=0-4',
      response as never,
    );

    expect(readingsService.getAudioStream).toHaveBeenCalledWith('LUM-001', 'client-1', 'bytes=0-4');
    expect(response.status).toHaveBeenCalledWith(206);
    expect(response.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes 0-4/5');
  });
});
