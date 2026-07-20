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
  birthDate: '1988-01-01',
  birthTime: '08:00',
  birthPlace: 'Paris, France',
  specificQuestion: 'Legacy question',
  objective: 'Legacy objective',
  facePhotoUrl: 's3://onboarding/user-1/face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
  highs: 'Legacy highs',
  lows: 'Legacy lows',
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
  birthDate: '1990-06-15',
  birthTime: '14:30',
  birthPlace: 'Lyon, France',
  specificQuestion: 'Sealed question',
  objective: 'Sealed objective',
  facePhotoUrl: 's3://onboarding/user-1/sealed-face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/sealed-palm.jpg',
  highs: 'Sealed highs',
  lows: 'Sealed lows',
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
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'abc123',
          profile: sealedProfile,
        },
      },
    });

    const resolved = resolver.resolve(order);

    expect(resolved.source).toBe('SEALED_INTAKE');
    expect(resolved.sealedAt).toBe('2026-07-18T12:00:00.000Z');
    expect(resolved.contentHash).toBe('abc123');
    expect(resolved.profile.specificQuestion).toBe('Sealed question');
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
    expect(resolved.profile.specificQuestion).toBe('Sealed question');
    expect(resolved.profile.objective).toBe('Sealed objective');
    expect(resolved.profile.specificQuestion).not.toBe('Current profile question');
  });

  it('falls back to UserProfile for legacy orders', () => {
    const order = buildOrder({ clientInputs: null });

    const resolved = resolver.resolve(order);

    expect(resolved.source).toBe('LEGACY_PROFILE');
    expect(resolved.sealedAt).toBeUndefined();
    expect(resolved.contentHash).toBeUndefined();
    expect(resolved.profile.specificQuestion).toBe('Legacy question');
    expect(resolved.profile.birthPlace).toBe('Paris, France');
  });

  it('rejects an incomplete sealed snapshot', () => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'hash-sealed',
          profile: {
            birthDate: '1990-06-15',
          },
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

  it('preserves private photo references from the sealed snapshot', () => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'hash-sealed',
          profile: sealedProfile,
        },
      },
    });

    const vertexProfile = resolver.toVertexUserProfile(order.user, resolver.resolve(order));

    expect(vertexProfile.facePhotoUrl).toBe('s3://onboarding/user-1/sealed-face.jpg');
    expect(vertexProfile.palmPhotoUrl).toBe('s3://onboarding/user-1/sealed-palm.jpg');
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

  it('exposes the resolved source for generation metadata', () => {
    const logSpy = jest.spyOn(resolver['logger'], 'log').mockImplementation(() => undefined);
    const order = buildOrder({
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
    expect(logSpy).toHaveBeenCalledWith('Reading source: SEALED_INTAKE');
    expect(
      logSpy.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('"event":"Reading source resolved"') &&
          call[0].includes('"source":"SEALED_INTAKE"'),
      ),
    ).toBe(true);
  });

  it('maps all reading fields into the Vertex profile shape', () => {
    const order = buildOrder({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-18T12:00:00.000Z',
          contentHash: 'hash-sealed',
          profile: sealedProfile,
        },
      },
    });

    const vertexProfile = resolver.toVertexUserProfile(order.user, resolver.resolve(order));

    expect(vertexProfile).toMatchObject({
      userId: 'user-1',
      firstName: 'Marie',
      lastName: 'Dubois',
      email: 'marie@example.test',
      birthDate: '1990-06-15',
      birthTime: '14:30',
      birthPlace: 'Lyon, France',
      specificQuestion: 'Sealed question',
      objective: 'Sealed objective',
      highs: 'Sealed highs',
      lows: 'Sealed lows',
      strongSide: 'Sealed strong',
      weakSide: 'Sealed weak',
      strongZone: 'Sealed strong zone',
      weakZone: 'Sealed weak zone',
      deliveryStyle: 'DIRECT',
      pace: 70,
      ailments: 'Sealed ailments',
      fears: 'Sealed fears',
      rituals: 'Sealed rituals',
    });
  });
});
