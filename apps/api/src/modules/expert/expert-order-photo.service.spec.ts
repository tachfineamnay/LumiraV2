import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpertOrderPhotoService } from './expert-order-photo.service';

describe('ExpertOrderPhotoService', () => {
  let service: ExpertOrderPhotoService;
  let prisma: PrismaService;

  const mockOrder = (overrides = {}) => ({
    userId: 'user-123',
    clientInputs: {},
    readingIntake: null,
    user: { profile: null },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    service = new ExpertOrderPhotoService(prisma);
  });

  it('throws NotFoundException if order is missing', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getReference('missing-order', 'face')).rejects.toThrow(NotFoundException);
  });

  it('resolves photo from effective snapshot first', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(
      mockOrder({
        clientInputs: {
          readingIntakeEffective: {
            profile: { facePhotoUrl: 's3://onboarding/user-123/face-effective.jpg' },
          },
          readingIntake: {
            profile: { facePhotoUrl: 's3://onboarding/user-123/face-projected.jpg' },
          },
        },
        readingIntake: {
          data: { facePhotoUrl: 's3://onboarding/user-123/face-relational.jpg' },
        },
        user: {
          profile: { facePhotoUrl: 's3://onboarding/user-123/face-profile.jpg' },
        },
      }),
    );

    const res = await service.getReference('order-1', 'face');
    expect(res).toEqual({
      userId: 'user-123',
      storageRef: 's3://onboarding/user-123/face-effective.jpg',
    });
  });

  it('falls back to relational intake if effective snapshot has no photo', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(
      mockOrder({
        clientInputs: {
          readingIntakeEffective: null,
          readingIntake: {
            profile: { facePhotoUrl: 's3://onboarding/user-123/face-projected.jpg' },
          },
        },
        readingIntake: {
          data: { facePhotoUrl: 's3://onboarding/user-123/face-relational.jpg' },
        },
        user: {
          profile: { facePhotoUrl: 's3://onboarding/user-123/face-profile.jpg' },
        },
      }),
    );

    const res = await service.getReference('order-1', 'face');
    expect(res).toEqual({
      userId: 'user-123',
      storageRef: 's3://onboarding/user-123/face-relational.jpg',
    });
  });

  it('falls back to captured projection if effective & relational have no photo', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(
      mockOrder({
        clientInputs: {
          readingIntake: {
            profile: { palmPhotoUrl: 's3://onboarding/user-123/palm-projected.jpg' },
          },
        },
        readingIntake: null,
        user: {
          profile: { palmPhotoUrl: 's3://onboarding/user-123/palm-profile.jpg' },
        },
      }),
    );

    const res = await service.getReference('order-1', 'palm');
    expect(res).toEqual({
      userId: 'user-123',
      storageRef: 's3://onboarding/user-123/palm-projected.jpg',
    });
  });

  it('falls back to user profile if no snapshot or intake contains the photo', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(
      mockOrder({
        clientInputs: {},
        readingIntake: null,
        user: {
          profile: { palmPhotoUrl: 's3://onboarding/user-123/palm-profile.jpg' },
        },
      }),
    );

    const res = await service.getReference('order-1', 'palm');
    expect(res).toEqual({
      userId: 'user-123',
      storageRef: 's3://onboarding/user-123/palm-profile.jpg',
    });
  });

  it('throws NotFoundException if photo is missing across all resolution levels', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(
      mockOrder({
        clientInputs: {},
        readingIntake: null,
        user: { profile: null },
      }),
    );

    await expect(service.getReference('order-1', 'face')).rejects.toThrow(NotFoundException);
  });

  it('works even when intake is incomplete without calling any readiness check', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(
      mockOrder({
        clientInputs: {
          readingIntake: {
            capturedAt: '2026-08-06T10:00:00.000Z',
            capturedFrom: 'READING_INTAKE_DRAFT',
            profile: { facePhotoUrl: 's3://onboarding/user-123/face-draft.jpg' },
          },
        },
        readingIntake: {
          status: 'DRAFT',
          data: { birthDate: null },
        },
      }),
    );

    const res = await service.getReference('order-1', 'face');
    expect(res).toEqual({
      userId: 'user-123',
      storageRef: 's3://onboarding/user-123/face-draft.jpg',
    });
  });
});
