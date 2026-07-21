import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import { ReadingIntakeService } from './reading-intake.service';

const validDto = {
  birthDate: '1990-06-15',
  birthPlace: 'Lyon, France',
  birthTime: '14:30',
  specificQuestion: 'Que dois-je comprendre maintenant ?',
  objective: 'Clarifier mon prochain mouvement',
  facePhotoUrl: 's3://onboarding/user-1/face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
  profileCompleted: true,
  consent: { accepted: true, version: '2026-07-18-user-agency-v1' },
};

describe('ReadingIntakeService', () => {
  let service: ReadingIntakeService;
  let prisma: Record<string, any>;
  let tx: Record<string, any>;

  beforeEach(() => {
    tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: 'PAID',
          clientInputs: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userProfile: {
        upsert: jest.fn().mockResolvedValue({
          id: 'profile-1',
          userId: 'user-1',
          profileCompleted: true,
        }),
      },
      consentRecord: { upsert: jest.fn().mockResolvedValue({}) },
      onboardingProgress: { upsert: jest.fn().mockResolvedValue({}) },
      readingIntake: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      order: { findFirst: jest.fn() },
    };
    const privatePhotos = {
      validateOnboardingPhoto: jest.fn(async (storageRef: string, userId: string) => {
        if (!storageRef.startsWith(`s3://onboarding/${userId}/`)) {
          throw new BadRequestException('Référence de photo invalide');
        }
        return {
          storageRef,
          key: storageRef.replace('s3://', ''),
          contentType: 'image/jpeg',
          size: 3,
          etag: 'etag',
          versionId: null,
        };
      }),
    } as unknown as PrivateOnboardingPhotoService;
    service = new ReadingIntakeService(prisma as PrismaService, privatePhotos);
  });

  it('atomically snapshots the client-selected intake into the paid order', async () => {
    const result = await service.seal('user-1', validDto);

    expect(result.sealed).toBe(true);
    expect(tx.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          birthDate: '1990-06-15',
          birthPlace: 'Lyon, France',
          profileCompleted: true,
        }),
      }),
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'order-1', status: 'PAID' }),
        data: {
          clientInputs: expect.objectContaining({
            readingIntake: expect.objectContaining({
              sealedBy: 'CLIENT',
              contentHash: expect.any(String),
              profile: expect.objectContaining({
                specificQuestion: validDto.specificQuestion,
                facePhotoUrl: validDto.facePhotoUrl,
              }),
            }),
          }),
        },
      }),
    );
  });

  it('requires explicit consent', async () => {
    await expect(
      service.seal('user-1', {
        ...validDto,
        consent: { accepted: false, version: validDto.consent.version },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a photo reference belonging to another user', async () => {
    await expect(
      service.seal('user-1', {
        ...validDto,
        facePhotoUrl: 's3://onboarding/user-2/face.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not replace an intake that has already been sealed', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      clientInputs: { readingIntake: { sealedAt: '2026-07-18T12:00:00.000Z' } },
    });

    await expect(service.seal('user-1', validDto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userProfile.upsert).not.toHaveBeenCalled();
  });

  it('rejects a late seal after production has started', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PROCESSING',
      clientInputs: null,
    });

    await expect(service.seal('user-1', validDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks profile edits while an active sealed reading exists', async () => {
    prisma.order.findMany = jest.fn().mockResolvedValue([
      {
        clientInputs: { readingIntake: { sealedAt: '2026-07-18T12:00:00.000Z' } },
        readingIntake: null,
      },
    ]);

    await expect(service.assertProfileEditable('user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows profile edits when there is no active sealed reading', async () => {
    prisma.order.findMany = jest.fn().mockResolvedValue([]);

    await expect(service.assertProfileEditable('user-1')).resolves.toBeUndefined();
  });
});
