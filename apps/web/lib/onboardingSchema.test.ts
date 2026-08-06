import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readingPreparationSubmissionSchema } from './onboardingSchema';

const base = {
  intentionMode: 'QUESTION' as const,
  usageName: 'Marie',
  birthDate: '1990-06-15',
  birthTime: '',
  birthPlace: 'Lyon, France',
  specificQuestion: 'Que dois-je comprendre dans cette période ?',
  objective: '',
  openReading: false,
  facePhoto: 's3://onboarding/user-1/face.jpg',
  palmPhoto: 's3://onboarding/user-1/palm.jpg',
  palmRole: 'PALM_UNKNOWN' as const,
  highs: '',
  lows: '',
  lifeEvents: '',
  lifeAreas: {},
  strongSide: '',
  weakSide: '',
  strongZone: '',
  weakZone: '',
  ailments: '',
  fears: '',
  rituals: '',
  deliveryStyle: 'DOUX_ET_CLAIR' as const,
  pace: 50,
  consent: true,
};

test('accepts a complete QUESTION dossier', () => {
  const result = readingPreparationSubmissionSchema.safeParse(base);
  assert.equal(result.success, true);
});

test('rejects either missing mandatory photo', () => {
  for (const field of ['facePhoto', 'palmPhoto'] as const) {
    const result = readingPreparationSubmissionSchema.safeParse({ ...base, [field]: '' });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.path[0] === field));
    }
  }
});

test('accepts an explicit clean OPEN dossier', () => {
  const result = readingPreparationSubmissionSchema.safeParse({
    ...base,
    intentionMode: 'OPEN',
    openReading: true,
    specificQuestion: '',
    objective: '',
  });
  assert.equal(result.success, true);
});

test('rejects OPEN when stale targeted text remains', () => {
  for (const patch of [
    { specificQuestion: 'Ancienne question encore présente', objective: '' },
    { specificQuestion: '', objective: 'Ancienne situation encore présente' },
  ]) {
    const result = readingPreparationSubmissionSchema.safeParse({
      ...base,
      intentionMode: 'OPEN',
      openReading: true,
      ...patch,
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.path[0] === 'intentionMode'));
    }
  }
});

test('rejects a text intention also flagged as open', () => {
  const result = readingPreparationSubmissionSchema.safeParse({
    ...base,
    intentionMode: 'QUESTION',
    openReading: true,
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === 'openReading'));
  }
});
