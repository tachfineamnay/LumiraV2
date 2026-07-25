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

  it('routes a confirmed order-scoped dossier to the immutable seal service', async () => {
    const updateProfile = jest.fn();
    const seal = jest.fn().mockResolvedValue({ sealed: true, orderId: 'order-draft' });
    const assertProfileEditable = jest.fn();
    const sealingController = new UsersController(
      { updateProfile } as unknown as UsersService,
      { seal, assertProfileEditable } as unknown as ReadingIntakeService,
      photoService,
    );
    const dto = {
      orderId: 'order-draft',
      intakeRevision: 7,
      profileCompleted: true,
      consent: { accepted: true, version: '2026-07-18-user-agency-v1' },
    };

    await expect(
      sealingController.updateProfile({ user: { userId: 'user-1' } }, dto),
    ).resolves.toMatchObject({ sealed: true, orderId: 'order-draft' });

    expect(seal).toHaveBeenCalledWith('user-1', dto);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(assertProfileEditable).not.toHaveBeenCalled();
  });

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
