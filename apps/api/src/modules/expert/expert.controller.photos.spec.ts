import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { ExpertController } from './expert.controller';
import { ExpertService } from './expert.service';
import { AdminSettingsService } from './admin-settings.service';
import { AudioGenerationService } from '../../services/factory/AudioGenerationService';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';

describe('ExpertController private photos', () => {
  const photoService = {
    getPhotoStream: jest.fn(),
  } as unknown as jest.Mocked<PrivateOnboardingPhotoService>;

  const controller = new ExpertController(
    {} as ExpertService,
    {} as AdminSettingsService,
    {} as AudioGenerationService,
    photoService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('streams a client palm photo for an authenticated expert', async () => {
    photoService.getPhotoStream.mockResolvedValue({
      stream: Readable.from(['img']),
      contentType: 'image/png',
      contentLength: 3,
    });
    const response = { setHeader: jest.fn() };

    await controller.streamClientPhoto(
      'client-9',
      'palm',
      { id: 'expert-1', role: 'EXPERT' } as never,
      response as never,
    );

    expect(photoService.getPhotoStream).toHaveBeenCalledWith({
      clientId: 'client-9',
      kind: 'palm',
      actorType: 'expert',
      actorId: 'expert-1',
    });
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300');
  });

  it('rejects an invalid photo kind for experts', async () => {
    await expect(
      controller.streamClientPhoto(
        'client-9',
        'invalid',
        { id: 'expert-1' } as never,
        { setHeader: jest.fn() } as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
