import {
  hashCanonicalJson,
  normalizeSnapshotProfile,
  resolveOriginalInput,
  sanitizeAmendmentData,
  hasOriginalInputProjection,
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

  it('whitelists a Prisma-like historical profile into strict reading JSON (no unwanted technical or private data)', () => {
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
    expect(normalizeSnapshotProfile({ birthDate: '1986-02-22T15:16:00.000Z' }).birthDate).toBe(
      '1986-02-22',
    );
  });

  it('accepts an existing sealed original input projection', () => {
    const existing = {
      readingIntake: {
        sealedAt: '2026-08-01T10:00:00.000Z',
        contentHash: 'hash-123',
        profile: { birthDate: '1990-01-01' },
      },
    };

    expect(hasOriginalInputProjection(existing)).toBe(true);
    const resolved = resolveOriginalInput(existing, null);
    expect(resolved).toBe(existing.readingIntake);
  });

  it('accepts an existing captured original input projection with capturedAt', () => {
    const existing = {
      readingIntake: {
        capturedAt: '2026-08-05T12:00:00.000Z',
        capturedFrom: 'READING_INTAKE_DRAFT',
        contentHash: 'hash-456',
        profile: { birthDate: '1990-01-01' },
      },
    };

    expect(hasOriginalInputProjection(existing)).toBe(true);
    const resolved = resolveOriginalInput(existing, null);
    expect(resolved).toBe(existing.readingIntake);
  });

  it('correctly captures a relational SEALED intake', () => {
    const intake = {
      id: 'intake-1',
      status: 'SEALED',
      data: { birthDate: '1990-01-01', birthPlace: 'Paris' },
      contentHash: 'sealed-hash-999',
      sealedAt: new Date('2026-08-01T10:00:00.000Z'),
    };

    const resolved = resolveOriginalInput({}, intake);

    expect(resolved).toMatchObject({
      version: 'relational-reading-intake-v1',
      sealedAt: '2026-08-01T10:00:00.000Z',
      contentHash: 'sealed-hash-999',
      profile: {
        birthDate: '1990-01-01',
        birthPlace: 'Paris',
      },
      assets: {},
      amendmentIds: [],
    });
    expect(resolved).not.toHaveProperty('capturedAt');
  });

  it('captures a DRAFT intake with capturedAt, no fake sealedAt, and a stable contentHash', () => {
    const capturedAt = new Date('2026-08-06T10:00:00.000Z');
    const intake = {
      id: 'intake-draft-1',
      status: 'DRAFT',
      data: { birthDate: '1992-05-10', birthPlace: 'Lyon' },
      contentHash: null,
      sealedAt: null,
    };

    const resolved = resolveOriginalInput({}, intake, { capturedAt });

    expect(resolved).toMatchObject({
      version: 'incomplete-reading-intake-capture-v1',
      capturedAt: '2026-08-06T10:00:00.000Z',
      capturedFrom: 'READING_INTAKE_DRAFT',
      sourceStatus: 'DRAFT',
      profile: {
        birthDate: '1992-05-10',
        birthPlace: 'Lyon',
      },
      assets: {},
      amendmentIds: [],
    });
    expect(resolved).not.toHaveProperty('sealedAt');
    expect(resolved.contentHash).toBeDefined();
    expect(typeof resolved.contentHash).toBe('string');
  });

  it('captures a missing intake with capturedFrom MISSING_READING_INTAKE using legacy profile fallback', () => {
    const capturedAt = new Date('2026-08-06T10:00:00.000Z');
    const legacyProfile = {
      birthDate: '1985-11-20',
      birthPlace: 'Bordeaux',
    };

    const resolved = resolveOriginalInput({}, null, {
      legacyProfile,
      capturedAt,
    });

    expect(resolved).toMatchObject({
      version: 'incomplete-reading-intake-capture-v1',
      capturedAt: '2026-08-06T10:00:00.000Z',
      capturedFrom: 'MISSING_READING_INTAKE',
      sourceStatus: 'MISSING',
      profile: {
        birthDate: '1985-11-20',
        birthPlace: 'Bordeaux',
      },
    });
    expect(resolved).not.toHaveProperty('sealedAt');
  });

  it('captures an incomplete intake in another status with capturedFrom READING_INTAKE_INCOMPLETE', () => {
    const capturedAt = new Date('2026-08-06T10:00:00.000Z');
    const intake = {
      id: 'intake-inc-1',
      status: 'SUBMITTED',
      data: { birthDate: '1995-03-03' },
      contentHash: null,
      sealedAt: null,
    };

    const resolved = resolveOriginalInput({}, intake, { capturedAt });

    expect(resolved).toMatchObject({
      version: 'incomplete-reading-intake-capture-v1',
      capturedAt: '2026-08-06T10:00:00.000Z',
      capturedFrom: 'READING_INTAKE_INCOMPLETE',
      sourceStatus: 'SUBMITTED',
      profile: {
        birthDate: '1995-03-03',
      },
    });
  });

  it('maintains legacy compatibility when intakeRequired === false', () => {
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

  it('generates identical contentHash for two identical captures at the same capturedAt', () => {
    const capturedAt = new Date('2026-08-06T12:00:00.000Z');
    const intake = {
      id: 'intake-1',
      status: 'DRAFT',
      data: { birthDate: '1990-01-01', birthPlace: 'Paris' },
      contentHash: null,
      sealedAt: null,
    };

    const cap1 = resolveOriginalInput({}, intake, { capturedAt });
    const cap2 = resolveOriginalInput({}, intake, { capturedAt });

    expect(cap1.contentHash).toBe(cap2.contentHash);
  });
});
