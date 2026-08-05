import {
  hashCanonicalJson,
  normalizeSnapshotProfile,
  resolveOriginalInput,
  sanitizeAmendmentData,
} from './profile-field-amendment.shared';

describe('profile field amendment shared helpers', () => {
  it('removes private storage references and asset identifiers from public data', () => {
    const sanitized = sanitizeAmendmentData({
      values: {
        birthPlace: 'Lyon',
        facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      },
      previousSubmission: {
        values: {
          palmPhotoUrl: 's3://onboarding/user-1/old-palm.jpg',
        },
      },
      preparedAssets: {
        face: {
          storageRef: 's3://onboarding/user-1/face.jpg',
          key: 'onboarding/user-1/face.jpg',
          etag: 'private-etag',
          versionId: 'private-version',
          sha256: 'private-sha',
          contentType: 'image/jpeg',
          size: 100,
        },
      },
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain('s3://onboarding/');
    expect(serialized).not.toContain('onboarding/user-1/');
    expect(serialized).not.toContain('private-etag');
    expect(serialized).not.toContain('private-version');
    expect(serialized).not.toContain('private-sha');
    expect(sanitized.photoFields).toEqual(['facePhotoUrl']);
  });

  it('does not reuse a superseded photo as current draft state', () => {
    const sanitized = sanitizeAmendmentData({
      previousSubmission: {
        values: {
          facePhotoUrl: 's3://onboarding/user-1/old-face.jpg',
          palmPhotoUrl: 's3://onboarding/user-1/old-palm.jpg',
        },
      },
      values: {},
    });

    expect(sanitized.photoFields).toBeUndefined();
  });

  it('creates a canonical hash independent of object key insertion order', () => {
    expect(hashCanonicalJson({ b: 2, a: 1 })).toBe(hashCanonicalJson({ a: 1, b: 2 }));
  });

  it('hashes Date, BigInt and undefined deterministically', () => {
    expect(() =>
      hashCanonicalJson({
        when: new Date('2026-08-05T12:00:00.000Z'),
        count: BigInt(3),
        ignored: undefined,
      }),
    ).not.toThrow();
  });

  it('whitelists a Prisma-like historical profile into strict reading JSON', () => {
    const profile = normalizeSnapshotProfile({
      id: 'profile-technical',
      userId: 'user-1',
      usageName: ' Greg ',
      birthDate: new Date('1986-02-22T15:16:00.000Z'),
      birthTime: null,
      birthPlace: 'Reims',
      specificQuestion: 'Que dois-je comprendre maintenant ?',
      objective: null,
      facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
      pace: 120.8,
      lifeAreas: {
        travail: { state: 'TENDU', note: '  Transition  ', createdAt: new Date() },
        invalid: { note: 'sans état' },
      },
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-02-01T10:00:00.000Z'),
      submittedAt: new Date('2026-03-01T10:00:00.000Z'),
      profileCompleted: true,
      relation: { secret: 'ignored' },
      impossible: BigInt(3),
      undefinedValue: undefined,
    });

    expect(profile).toMatchObject({
      usageName: 'Greg',
      birthDate: '1986-02-22',
      birthPlace: 'Reims',
      intentionMode: 'QUESTION',
      openReading: false,
      facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
      palmRole: 'PALM_UNKNOWN',
      pace: 100,
      lifeAreas: {
        travail: { state: 'TENDU', note: 'Transition' },
      },
    });
    for (const forbidden of [
      'id',
      'userId',
      'createdAt',
      'updatedAt',
      'submittedAt',
      'profileCompleted',
      'relation',
      'impossible',
      'undefinedValue',
    ]) {
      expect(profile).not.toHaveProperty(forbidden);
    }
    expect(() => JSON.stringify(profile)).not.toThrow();
  });

  it('creates a date-only birth value from an ISO date string', () => {
    expect(
      normalizeSnapshotProfile({ birthDate: '1986-02-22T15:16:00.000Z' }).birthDate,
    ).toBe('1986-02-22');
  });

  it('captures an immutable legacy base without modifying the live profile', () => {
    const legacyProfile = {
      birthDate: '1990-01-01',
      birthPlace: 'Paris',
      specificQuestion: 'Que dois-je comprendre maintenant ?',
      facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const frozen = structuredClone(legacyProfile);

    const original = resolveOriginalInput({}, null, {
      intakeRequired: false,
      legacyProfile,
      capturedAt: new Date('2026-08-05T12:00:00.000Z'),
    });

    expect(original).toMatchObject({
      version: 'legacy-profile-capture-v1',
      sealedAt: '2026-08-05T12:00:00.000Z',
      capturedAt: '2026-08-05T12:00:00.000Z',
      capturedFrom: 'LEGACY_USER_PROFILE',
      contentHash: expect.any(String),
      profile: {
        birthDate: '1990-01-01',
        birthPlace: 'Paris',
        intentionMode: 'QUESTION',
      },
    });
    expect(legacyProfile).toEqual(frozen);
    expect(() => JSON.stringify(original)).not.toThrow();
  });
});
