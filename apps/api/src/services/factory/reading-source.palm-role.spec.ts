import { ReadingSourceResolver } from './reading-source.resolver';

describe('ReadingSourceResolver palm role propagation', () => {
  it('passes the declared palm role from the sealed snapshot to the AI profile', () => {
    const resolver = new ReadingSourceResolver();
    const order = {
      id: 'order-1',
      orderNumber: 'ORD-1',
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-08-05T12:00:00.000Z',
          contentHash: 'hash-1',
          profile: {
            intentionMode: 'OPEN',
            openReading: true,
            specificQuestion: null,
            objective: null,
            birthDate: '1990-06-15',
            birthPlace: 'Lyon, France',
            facePhotoUrl: 's3://onboarding/user-1/face.jpg',
            palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
            palmRole: 'PALM_LEFT',
          },
        },
      },
      user: {
        id: 'user-1',
        firstName: 'Marie',
        lastName: 'Dubois',
        email: 'marie@example.test',
        profile: null,
      },
    };

    const resolved = resolver.resolve(order);
    const aiProfile = resolver.toVertexUserProfile(order.user, resolved) as unknown as {
      palmRole?: string;
    };

    expect(resolved.profile.palmRole).toBe('PALM_LEFT');
    expect(aiProfile.palmRole).toBe('PALM_LEFT');
  });
});
