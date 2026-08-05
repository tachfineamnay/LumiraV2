import {
  READING_REQUIREMENTS_VERSION,
  evaluateReadingRequirements,
  isPrivateOnboardingPhotoReference,
} from './reading-intake-policy';

const completeProfile = {
  birthDate: '1990-06-15',
  birthPlace: 'Lyon, France',
  intentionMode: 'QUESTION',
  openReading: false,
  specificQuestion: 'Que dois-je comprendre dans cette période ?',
  objective: null,
  facePhotoUrl: 's3://onboarding/user-1/face-1.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/palm-1.jpg',
};

describe('reading intake policy', () => {
  it('requires date, place, explicit intention, face and palm', () => {
    const result = evaluateReadingRequirements({}, {
      requireExplicitIntentionMode: true,
      strictIntentionExclusivity: true,
    });

    expect(result.requirementsVersion).toBe(READING_REQUIREMENTS_VERSION);
    expect(result.complete).toBe(false);
    expect(result.missingFields).toEqual([
      'birthDate',
      'birthPlace',
      'intention',
      'facePhotoUrl',
      'palmPhotoUrl',
    ]);
  });

  it('accepts a complete QUESTION intake', () => {
    expect(
      evaluateReadingRequirements(completeProfile, {
        requireExplicitIntentionMode: true,
        strictIntentionExclusivity: true,
      }),
    ).toMatchObject({
      complete: true,
      missingFields: [],
      invalidFields: [],
      intention: { mode: 'QUESTION', valid: true, explicit: true },
      photos: { face: 'VALID', palm: 'VALID' },
    });
  });

  it('accepts a complete SITUATION intake', () => {
    const result = evaluateReadingRequirements(
      {
        ...completeProfile,
        intentionMode: 'SITUATION',
        specificQuestion: null,
        objective: 'Clarifier la direction professionnelle à prendre.',
      },
      { requireExplicitIntentionMode: true, strictIntentionExclusivity: true },
    );
    expect(result.complete).toBe(true);
    expect(result.intention.mode).toBe('SITUATION');
  });

  it('accepts an explicitly chosen OPEN intake', () => {
    const result = evaluateReadingRequirements(
      {
        ...completeProfile,
        intentionMode: 'OPEN',
        specificQuestion: null,
        objective: null,
        openReading: true,
      },
      { requireExplicitIntentionMode: true, strictIntentionExclusivity: true },
    );
    expect(result.complete).toBe(true);
    expect(result.intention.mode).toBe('OPEN');
  });

  it('rejects an incoherent explicit intention mode', () => {
    const result = evaluateReadingRequirements(
      { ...completeProfile, openReading: true },
      { requireExplicitIntentionMode: true, strictIntentionExclusivity: true },
    );
    expect(result.complete).toBe(false);
    expect(result.invalidFields).toContain('intention');
  });

  it('rejects either missing photo independently', () => {
    expect(
      evaluateReadingRequirements({ ...completeProfile, facePhotoUrl: null }, {
        requireExplicitIntentionMode: true,
      }).missingFields,
    ).toContain('facePhotoUrl');
    expect(
      evaluateReadingRequirements({ ...completeProfile, palmPhotoUrl: null }, {
        requireExplicitIntentionMode: true,
      }).missingFields,
    ).toContain('palmPhotoUrl');
  });

  it('rejects public or cross-scheme photo references', () => {
    expect(isPrivateOnboardingPhotoReference('https://example.com/face.jpg')).toBe(false);
    expect(isPrivateOnboardingPhotoReference('s3://onboarding/../face.jpg')).toBe(false);
    expect(isPrivateOnboardingPhotoReference('s3://onboarding/user-1/face.jpg')).toBe(true);
  });

  it('allows a limited but present photo while exposing its status', () => {
    const result = evaluateReadingRequirements(completeProfile, {
      requireExplicitIntentionMode: true,
      facePhotoStatus: 'LIMITED',
      palmPhotoStatus: 'VALID',
    });
    expect(result.complete).toBe(true);
    expect(result.photos.face).toBe('LIMITED');
  });
});
