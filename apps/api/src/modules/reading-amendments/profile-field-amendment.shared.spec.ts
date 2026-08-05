import { ConflictException } from '@nestjs/common';
import {
  hasOriginalInputProjection,
  resolveOriginalInput,
} from './profile-field-amendment.shared';

describe('profile amendment original input projection', () => {
  it('captures a deterministic immutable base for a legacy order', () => {
    const capturedAt = new Date('2026-08-05T12:00:00.000Z');
    const original = resolveOriginalInput({}, null, {
      intakeRequired: false,
      capturedAt,
      legacyProfile: {
        birthDate: '1990-06-15',
        birthPlace: 'Lyon, France',
        facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      },
    });

    expect(original).toMatchObject({
      version: 'legacy-profile-capture-v1',
      sealedAt: capturedAt.toISOString(),
      legacy: true,
      profile: {
        birthDate: '1990-06-15',
        birthPlace: 'Lyon, France',
        facePhotoUrl: 's3://onboarding/user-1/face.jpg',
      },
      assets: {},
    });
    expect(original.contentHash).toEqual(expect.any(String));
    expect(hasOriginalInputProjection({ readingIntake: original })).toBe(true);
  });

  it('never fabricates a base for a new order requiring a sealed intake', () => {
    expect(() =>
      resolveOriginalInput({}, null, {
        intakeRequired: true,
        legacyProfile: { birthDate: '1990-06-15' },
      }),
    ).toThrow(ConflictException);
  });
});
