import { ReadingSourceResolver } from './reading-source.resolver';

const user = {
  id: 'user-1',
  firstName: 'Marie',
  lastName: 'Dubois',
  email: 'marie@example.test',
  profile: null,
};

const original = {
  sealedAt: '2026-08-01T10:00:00.000Z',
  contentHash: 'original-hash',
  profile: {
    birthDate: '1990-06-15',
    birthPlace: 'Lyon, France',
    specificQuestion: 'Question originale',
    palmPhotoUrl: null,
  },
};

const effective = {
  snapshotId: 'ris-1',
  revision: 1,
  effectiveAt: '2026-08-02T10:00:00.000Z',
  contentHash: 'effective-hash',
  amendmentIds: ['ram-1'],
  profile: {
    ...original.profile,
    palmPhotoUrl: 's3://onboarding/user-1/palm-new.jpg',
    palmRole: 'PALM_RIGHT',
  },
};

describe('ReadingSourceResolver amendment snapshots', () => {
  it('prioritizes the effective snapshot without mutating the original intake', () => {
    const resolver = new ReadingSourceResolver();
    const clientInputs = {
      readingIntake: structuredClone(original),
      readingIntakeEffective: structuredClone(effective),
    };
    const frozenOriginal = structuredClone(clientInputs.readingIntake);

    const resolved = resolver.resolve({
      id: 'order-1',
      orderNumber: 'LUM-001',
      clientInputs,
      user,
    });

    expect(resolved).toMatchObject({
      source: 'EFFECTIVE_SNAPSHOT',
      inputSnapshotId: 'ris-1',
      revision: 1,
      contentHash: 'effective-hash',
      amendmentIds: ['ram-1'],
      profile: {
        birthDate: '1990-06-15',
        birthPlace: 'Lyon, France',
        palmPhotoUrl: 's3://onboarding/user-1/palm-new.jpg',
        palmRole: 'PALM_RIGHT',
      },
    });
    expect(clientInputs.readingIntake).toEqual(frozenOriginal);
  });

  it('rejects a malformed effective snapshot instead of silently using V1', () => {
    const resolver = new ReadingSourceResolver();

    expect(() =>
      resolver.resolve({
        id: 'order-1',
        orderNumber: 'LUM-001',
        clientInputs: {
          readingIntake: original,
          readingIntakeEffective: {
            snapshotId: 'ris-broken',
            contentHash: 'broken-hash',
            profile: { birthDate: '1990-06-15' },
          },
        },
        user,
      }),
    ).toThrow('snapshot effectif');
  });
});
