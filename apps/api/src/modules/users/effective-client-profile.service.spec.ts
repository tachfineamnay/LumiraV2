import { EffectiveClientProfileService } from './effective-client-profile.service';

describe('EffectiveClientProfileService', () => {
  const persistedProfile = {
    id: 'profile-1',
    userId: 'user-1',
    usageName: 'Claire',
    birthDate: '1990-01-01',
    birthTime: null,
    birthPlace: 'Paris',
    specificQuestion: null,
    objective: null,
    facePhotoUrl: 's3://onboarding/user-1/face-old.jpg',
    palmPhotoUrl: 's3://onboarding/user-1/palm-old.jpg',
    highs: null,
    lows: null,
    lifeEvents: null,
    lifeAreas: null,
    strongSide: null,
    weakSide: null,
    strongZone: null,
    weakZone: null,
    deliveryStyle: null,
    pace: null,
    ailments: null,
    fears: null,
    rituals: null,
    profileCompleted: true,
    submittedAt: new Date('2026-08-01T10:00:00.000Z'),
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
  };

  it('overlays the newest approved effective snapshot without mutating the persisted profile', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            clientInputs: {
              readingIntakeEffective: {
                snapshotId: 'ris-new',
                revision: 2,
                effectiveAt: '2026-08-05T10:00:00.000Z',
                profile: {
                  palmPhotoUrl: 's3://onboarding/user-1/palm-new.jpg',
                  birthPlace: 'Lyon',
                },
              },
            },
          },
          {
            clientInputs: {
              readingIntakeEffective: {
                snapshotId: 'ris-old',
                revision: 1,
                effectiveAt: '2026-08-04T10:00:00.000Z',
                profile: {
                  palmPhotoUrl: 's3://onboarding/user-1/palm-older.jpg',
                },
              },
            },
          },
        ]),
      },
    };
    const service = new EffectiveClientProfileService(prisma as never);

    const result = await service.resolveProfile('user-1', persistedProfile as never);

    expect(result.snapshotId).toBe('ris-new');
    expect(result.snapshotRevision).toBe(2);
    expect(result.profile?.palmPhotoUrl).toBe('s3://onboarding/user-1/palm-new.jpg');
    expect(result.profile?.birthPlace).toBe('Lyon');
    expect(persistedProfile.palmPhotoUrl).toBe('s3://onboarding/user-1/palm-old.jpg');
  });

  it('falls back to the persisted photo when no effective snapshot exists', async () => {
    const prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new EffectiveClientProfileService(prisma as never);

    await expect(
      service.resolvePhotoReference(
        'user-1',
        'palm',
        's3://onboarding/user-1/palm-old.jpg',
      ),
    ).resolves.toBe('s3://onboarding/user-1/palm-old.jpg');
  });
});
