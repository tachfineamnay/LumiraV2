import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ReadingIntakeService } from './reading-intake.service';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';

describe('UsersController private photos', () => {
  const usersService = {} as UsersService;
  const readingIntakeService = {} as ReadingIntakeService;
  const photoService = {
    getPhotoStream: jest.fn(),
  } as unknown as jest.Mocked<PrivateOnboardingPhotoService>;
  const controller = new UsersController(usersService, readingIntakeService, photoService);

  beforeEach(() => jest.clearAllMocks());

  it('streams the authenticated user face photo and never accepts a foreign userId', async () => {
    photoService.getPhotoStream.mockResolvedValue({
      stream: Readable.from(['img']),
      contentType: 'image/jpeg',
      contentLength: 3,
      etag: '"abc"',
      lastModified: new Date('2026-07-01T00:00:00.000Z'),
    });
    const response = { setHeader: jest.fn() };

    await controller.streamOwnPhoto('face', { user: { userId: 'user-1' } }, response as never);

    expect(photoService.getPhotoStream).toHaveBeenCalledWith({
      clientId: 'user-1',
      kind: 'face',
      actorType: 'client',
      actorId: 'user-1',
    });
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline');
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('rejects an invalid photo kind', async () => {
    await expect(
      controller.streamOwnPhoto('nose', { user: { userId: 'user-1' } }, {
        setHeader: jest.fn(),
      } as never),
    ).rejects.toThrow(BadRequestException);
    expect(photoService.getPhotoStream).not.toHaveBeenCalled();
  });
});
