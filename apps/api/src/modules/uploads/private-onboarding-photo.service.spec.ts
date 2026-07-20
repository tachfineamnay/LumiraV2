import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { PrivateOnboardingPhotoService } from './private-onboarding-photo.service';
import { S3Service } from './s3.service';

describe('PrivateOnboardingPhotoService', () => {
  const prisma = {
    userProfile: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const s3Service = {
    getObject: jest.fn(),
  } as unknown as jest.Mocked<S3Service>;

  const service = new PrivateOnboardingPhotoService(prisma as never, s3Service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseStorageReference', () => {
    it('accepts a valid face reference', () => {
      expect(service.parseStorageReference('s3://onboarding/user-1/face-123.jpg', 'user-1')).toBe(
        'onboarding/user-1/face-123.jpg',
      );
    });

    it('accepts a valid palm reference', () => {
      expect(service.parseStorageReference('s3://onboarding/user-1/palm-123.webp', 'user-1')).toBe(
        'onboarding/user-1/palm-123.webp',
      );
    });

    it('rejects a reference belonging to another user', () => {
      expect(() =>
        service.parseStorageReference('s3://onboarding/user-2/face-123.jpg', 'user-1'),
      ).toThrow(BadRequestException);
    });

    it('rejects http references', () => {
      expect(() =>
        service.parseStorageReference('https://cdn.example.com/face.jpg', 'user-1'),
      ).toThrow(BadRequestException);
    });

    it('rejects path traversal', () => {
      expect(() =>
        service.parseStorageReference('s3://onboarding/user-1/../secret.jpg', 'user-1'),
      ).toThrow(BadRequestException);
    });

    it('rejects empty references', () => {
      expect(() => service.parseStorageReference('', 'user-1')).toThrow(BadRequestException);
    });

    it('rejects readings-style keys', () => {
      expect(() =>
        service.parseStorageReference('s3://onboarding/user-1/readings/file.pdf', 'user-1'),
      ).toThrow(BadRequestException);
    });
  });

  describe('getPhotoStream', () => {
    it('streams from the uploads bucket for a client face photo', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        facePhotoUrl: 's3://onboarding/user-1/face-1.jpg',
        palmPhotoUrl: null,
      });
      s3Service.getObject.mockResolvedValue({
        stream: Readable.from(['img']),
        contentType: 'image/jpeg',
        contentLength: 3,
      });

      const result = await service.getPhotoStream({
        clientId: 'user-1',
        kind: 'face',
        actorType: 'client',
        actorId: 'user-1',
      });

      expect(s3Service.getObject).toHaveBeenCalledWith('onboarding/user-1/face-1.jpg', 'uploads');
      expect(result.contentType).toBe('image/jpeg');
    });

    it('returns 404 when the profile has no photo', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        facePhotoUrl: null,
        palmPhotoUrl: null,
      });

      await expect(
        service.getPhotoStream({
          clientId: 'user-1',
          kind: 'palm',
          actorType: 'client',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(s3Service.getObject).not.toHaveBeenCalled();
    });

    it('maps a missing S3 object to 404', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        facePhotoUrl: 's3://onboarding/user-1/face-1.jpg',
        palmPhotoUrl: null,
      });
      s3Service.getObject.mockRejectedValue(new NotFoundException('Fichier introuvable'));

      await expect(
        service.getPhotoStream({
          clientId: 'user-1',
          kind: 'face',
          actorType: 'client',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows an expert to load another client photo after client existence check', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'client-9' });
      prisma.userProfile.findUnique.mockResolvedValue({
        facePhotoUrl: null,
        palmPhotoUrl: 's3://onboarding/client-9/palm-9.png',
      });
      s3Service.getObject.mockResolvedValue({
        stream: Readable.from(['img']),
        contentType: 'image/png',
      });

      await service.getPhotoStream({
        clientId: 'client-9',
        kind: 'palm',
        actorType: 'expert',
        actorId: 'expert-1',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-9' },
        select: { id: true },
      });
      expect(s3Service.getObject).toHaveBeenCalledWith('onboarding/client-9/palm-9.png', 'uploads');
    });

    it('rejects expert access when the client does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getPhotoStream({
          clientId: 'missing',
          kind: 'face',
          actorType: 'expert',
          actorId: 'expert-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
