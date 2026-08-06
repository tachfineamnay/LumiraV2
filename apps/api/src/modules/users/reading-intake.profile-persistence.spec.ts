import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import { ReadingIntakeService } from './reading-intake.service';

describe('ReadingIntakeService profile persistence', () => {
  it('keeps intake-only intention and palm metadata out of UserProfile', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'profile-1', userId: 'user-1' });
    const tx = { userProfile: { upsert } } as unknown as Prisma.TransactionClient;
    const service = new ReadingIntakeService(
      {} as PrismaService,
      {} as PrivateOnboardingPhotoService,
    );

    await (
      service as unknown as {
        upsertProfile: (
          client: Prisma.TransactionClient,
          userId: string,
          profile: Record<string, unknown>,
          submittedAt: Date,
        ) => Promise<unknown>;
      }
    ).upsertProfile(
      tx,
      'user-1',
      {
        intentionMode: 'OPEN',
        openReading: true,
        usageName: 'Greg',
        birthDate: '1986-02-22',
        birthTime: '15:16',
        birthPlace: 'Reims',
        specificQuestion: null,
        objective: null,
        facePhotoUrl: 's3://onboarding/user-1/face.jpg',
        palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
        palmRole: 'PALM_RIGHT',
        highs: null,
        lows: null,
        lifeEvents: null,
        lifeAreas: null,
        strongSide: null,
        weakSide: null,
        strongZone: null,
        weakZone: null,
        deliveryStyle: 'DOUX_ET_CLAIR',
        pace: 50,
        ailments: null,
        fears: null,
        rituals: null,
      },
      new Date('2026-07-27T15:20:00.000Z'),
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    const payload = upsert.mock.calls[0][0];
    for (const metadata of ['palmRole', 'openReading', 'intentionMode']) {
      expect(payload.create).not.toHaveProperty(metadata);
      expect(payload.update).not.toHaveProperty(metadata);
    }
    expect(payload.create).toMatchObject({
      userId: 'user-1',
      birthDate: '1986-02-22',
      birthPlace: 'Reims',
      facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
      profileCompleted: true,
    });
  });
});
