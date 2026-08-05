import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ReadingIntakeService } from './reading-intake.service';
import { EffectiveClientProfileService } from './effective-client-profile.service';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import { S3Service } from '../uploads/s3.service';

describe('UsersController private photos', () => {
  const usersService = {
    getUserProfile: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;
  const readingIntakeService = {} as ReadingIntakeService;
  const effectiveProfiles = {
    resolvePhotoReference: jest.fn(),
    resolveProfile: jest.fn(),
  } as unknown as jest.Mocked<EffectiveClientProfileService>;
  const photoService = {
    parseStorageReference: jest.fn(),
    getPhotoStream: jest.fn(),
  } as unknown as jest.Mocked<PrivateOnboardingPhotoService>;
  const s3Service = {
    getObject: jest.fn(),
  } as unknown as jest.Mocked<S3Service>;
  const controller = new UsersController(
    usersService,
    readingIntakeService,
    effectiveProfiles,
    photoService,
    s3Service,
  );

  beforeEach(() => jest.clearAllMocks());

  it('routes a confirmed order-scoped dossier to the immutable seal service', async () => {
    const updateProfile = jest.fn();
    const seal = jest.fn().mockResolvedValue({ sealed: true, orderId: 'order-draft' });
    const assertProfileEditable = jest.fn();
    const sealingController = new UsersController(
      { updateProfile } as unknown as UsersService,
      { seal, assertProfileEditable } as unknown as ReadingIntakeService,
      effectiveProfiles,
      photoService,
      s3Service,
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

  it('streams the effective authenticated-user photo and never accepts a foreign userId', async () => {
    usersService.getUserProfile.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { facePhotoUrl: 's3://onboarding/user-1/face-old.jpg' },
      stats: { totalOrders: 1, completedOrders: 1 },
    } as never);
    effectiveProfiles.resolvePhotoReference.mockResolvedValue(
      's3://onboarding/user-1/face-effective.jpg',
    );
    photoService.parseStorageReference.mockReturnValue(
      'onboarding/user-1/face-effective.jpg',
    );
    s3Service.getObject.mockResolvedValue({
      stream: Readable.from(['img']),
      contentType: 'image/jpeg',
      contentLength: 3,
      etag: '"abc"',
      lastModified: new Date('2026-07-01T00:00:00.000Z'),
    });
    const response = { setHeader: jest.fn() };

    await controller.streamOwnPhoto('face', { user: { userId: 'user-1' } }, response as never);

    expect(effectiveProfiles.resolvePhotoReference).toHaveBeenCalledWith(
      'user-1',
      'face',
      's3://onboarding/user-1/face-old.jpg',
    );
    expect(photoService.parseStorageReference).toHaveBeenCalledWith(
      's3://onboarding/user-1/face-effective.jpg',
      'user-1',
    );
    expect(s3Service.getObject).toHaveBeenCalledWith(
      'onboarding/user-1/face-effective.jpg',
      'uploads',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, no-cache, must-revalidate',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline');
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('rejects an invalid photo kind before any storage lookup', async () => {
    await expect(
      controller.streamOwnPhoto('nose', { user: { userId: 'user-1' } }, {
        setHeader: jest.fn(),
      } as never),
    ).rejects.toThrow(BadRequestException);
    expect(usersService.getUserProfile).not.toHaveBeenCalled();
    expect(effectiveProfiles.resolvePhotoReference).not.toHaveBeenCalled();
    expect(s3Service.getObject).not.toHaveBeenCalled();
  });
});
