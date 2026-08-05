import { BadRequestException } from '@nestjs/common';
import { UserProfile as PrismaUserProfile } from '@prisma/client';
import { OrderForReadingSource, ReadingSourceResolver } from './reading-source.resolver';

const baseUser = {
  id: 'user-1',
  firstName: 'Marie',
  lastName: 'Dubois',
  email: 'marie@example.test',
};

const legacyProfile: PrismaUserProfile = {
  id: 'profile-1',
  userId: 'user-1',
  usageName: null,
  birthDate: '1988-01-01',
  birthTime: '08:00',
  birthPlace: 'Paris, France',
  specificQuestion: 'Legacy question sufficiently detailed',
  objective: null,
  facePhotoUrl: 's3://onboarding/user-1/face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
  highs: 'Legacy highs',
  lows: 'Legacy lows',
  lifeEvents: null,
  lifeAreas: null,
  strongSide: 'Legacy strong',
  weakSide: 'Legacy weak',
  strongZone: 'Legacy strong zone',
  weakZone: 'Legacy weak zone',
  deliveryStyle: 'DOUX_ET_CLAIR',
  pace: 40,
  ailments: 'Legacy ailments',
  fears: 'Legacy fears',
  rituals: 'Legacy rituals',
  profileCompleted: true,
  submittedAt: new Date('2026-01-01'),
  preferredVoice: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sealedProfile = {
  intentionMode: 'QUESTION',
  openReading: false,
  usageName: 'Mimi',
  birthDate: '1990-06-15',
  birthTime: '14:30',
  birthPlace: 'Lyon, France',
  specificQuestion: 'Que dois-je comprendre dans cette période ?',
  objective: null,
  facePhotoUrl: 's3://onboarding/user-1/sealed-face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/sealed-palm.jpg',
  palmRole: 'PALM_RIGHT',
  highs: 'Sealed highs',
  lows: 'Sealed lows',
  lifeEvents: 'Sealed life events',
  lifeAreas: {
    relations: { state: 'TENDU', note: 'Sealed note' },
    travail: { state: 'FLUIDE' },
  },
  strongSide: 'Sealed strong',
  weakSide: 'Sealed weak',
  strongZone: 'Sealed strong zone',
  weakZone: 'Sealed weak zone',
  deliveryStyle: 'DIRECT',
  pace: 70,
  ailments: 'Sealed ailments',
  fears: 'Sealed fears',
  rituals: 'Sealed rituals',
};

function buildOrder(
  overrides: Partial<OrderForReadingSource> & {
    clientInputs?: unknown;
    profile?: PrismaUserProfile | null;
  } = {},
): OrderForReadingSource {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    clientInputs: overrides.clientInputs ?? null,
    user: {
      ...baseUser,
      profile: overrides.profile ?? legacyProfile,
    },
    ...overrides,
  };
}

describe('ReadingSourceResolver', () => {
  let resolver: ReadingSourceResolver;

  beforeEach(() => {
    resolver = new ReadingSourceResolver();
  });

  it('uses a valid sealed dossier in priority', () => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          requirementsVersion: '2026-08-05-required-intake-v2',
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'abc123',
          profile: sealedProfile,
        },
      },
    });

    const resolved = resolver.resolve(order);

    expect(resolved.source).toBe('SEALED_INTAKE');
    expect(resolved.requirementsVersion).toBe('2026-08-05-required-intake-v2');
    expect(resolved.sealedAt).toBe('2026-07-18T12:00:00.000Z');
    expect(resolved.contentHash).toBe('abc123');
    expect(resolved.profile.intentionMode).toBe('QUESTION');
    expect(resolved.profile.facePhotoUrl).toBe('s3://onboarding/user-1/sealed-face.jpg');
  });

  it('ignores the current profile when a sealed dossier is present', () => {
    const order = buildOrder({
      profile: {
        ...legacyProfile,
        specificQuestion: 'Current profile question',
        objective: 'Current profile objective',
      },
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'hash-sealed',
          profile: sealedProfile,
        },
      },
    });

    const resolved = resolver.resolve(order);

    expect(resolved.source).toBe('SEALED_INTAKE');
    expect(resolved.profile.specificQuestion).toBe(sealedProfile.specificQuestion);
    expect(resolved.profile.specificQuestion).not.toBe('Current profile question');
  });

  it('falls back to UserProfile for historical reads', () => {
    const order = buildOrder({ clientInputs: null });

    const resolved = resolver.resolve(order);

    expect(resolved.source).toBe('LEGACY_PROFILE');
    expect(resolved.sealedAt).toBeUndefined();
    expect(resolved.contentHash).toBeUndefined();
    expect(resolved.profile.intentionMode).toBe('QUESTION');
    expect(resolved.profile.birthPlace).toBe('Paris, France');
  });

  it.each([
    ['birthPlace', ''],
    ['specificQuestion', ''],
    ['facePhotoUrl', null],
    ['palmPhotoUrl', null],
  ])('rejects a sealed snapshot with invalid %s', (field, value) => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'hash-sealed',
          profile: { ...sealedProfile, [field]: value },
        },
      },
    });

    expect(() => resolver.resolve(order)).toThrow(BadRequestException);
  });

  it('rejects a sealed snapshot without contentHash', () => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          profile: sealedProfile,
        },
      },
    });

    expect(() => resolver.resolve(order)).toThrow(BadRequestException);
  });

  it('preserves private photo references and explicit intention for Vertex', () => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'hash-sealed',
          profile: sealedProfile,
        },
      },
    });

    const vertexProfile = resolver.toVertexUserProfile(order.user, resolver.resolve(order)) as
      typeof legacyProfile & { intentionMode?: string; openReading?: boolean };

    expect(vertexProfile.facePhotoUrl).toBe('s3://onboarding/user-1/sealed-face.jpg');
    expect(vertexProfile.palmPhotoUrl).toBe('s3://onboarding/user-1/sealed-palm.jpg');
    expect(vertexProfile.intentionMode).toBe('QUESTION');
    expect(vertexProfile.openReading).toBe(false);
  });

  it('does not mutate the sealed snapshot while resolving', () => {
    const snapshot = {
      readingIntake: {
        sealedAt: '2026-07-18T12:00:00.000Z',
        contentHash: 'hash-sealed',
        profile: { ...sealedProfile },
      },
    };
    const frozen = structuredClone(snapshot);
    const order = buildOrder({ clientInputs: snapshot });

    resolver.resolve(order);

    expect(snapshot).toEqual(frozen);
  });

  it('uses a complete effective snapshot before the original sealed intake', () => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'original',
          profile: sealedProfile,
        },
        readingIntakeEffective: {
          snapshotId: 'snapshot-2',
          contentHash: 'effective',
          requirementsVersion: '2026-08-05-required-intake-v2',
          effectiveAt: '2026-08-05T12:00:00.000Z',
          profile: {
            ...sealedProfile,
            specificQuestion: 'Quelle direction est maintenant la plus juste ?',
          },
          amendmentIds: ['amendment-1'],
        },
      },
    });

    const resolved = resolver.resolve(order);
    expect(resolved).toMatchObject({
      source: 'EFFECTIVE_SNAPSHOT',
      inputSnapshotId: 'snapshot-2',
      contentHash: 'effective',
      amendmentIds: ['amendment-1'],
    });
    expect(resolved.profile.specificQuestion).toBe(
      'Quelle direction est maintenant la plus juste ?',
    );
  });
});
