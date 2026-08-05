import { BadRequestException } from '@nestjs/common';
import {
  expandProfileAmendmentValues,
  normalizeRequestedProfileFields,
  parseProfileFields,
  publicProfileFields,
} from './profile-field-catalog';

describe('profile field catalog', () => {
  it('normalizes the palm dependency without duplicating fields', () => {
    expect(
      normalizeRequestedProfileFields(['birthDate', 'palmPhotoUrl', 'birthDate']),
    ).toEqual(['birthDate', 'palmPhotoUrl', 'palmRole']);
  });

  it('accepts only the five closed business fields', () => {
    expect(
      normalizeRequestedProfileFields([
        'birthDate',
        'birthPlace',
        'intention',
        'facePhotoUrl',
        'palmPhotoUrl',
      ]),
    ).toEqual([
      'birthDate',
      'birthPlace',
      'intention',
      'facePhotoUrl',
      'palmPhotoUrl',
      'palmRole',
    ]);
  });

  it('rejects arbitrary profile paths and direct palmRole requests', () => {
    expect(() => normalizeRequestedProfileFields(['rituals'])).toThrow(BadRequestException);
    expect(() => normalizeRequestedProfileFields(['palmRole'])).toThrow(BadRequestException);
    expect(() => parseProfileFields(['profile.birthDate'])).toThrow(BadRequestException);
  });

  it('hides palmRole from the public requested field list', () => {
    expect(publicProfileFields(['palmPhotoUrl', 'palmRole'])).toEqual(['palmPhotoUrl']);
  });

  it('expands the virtual intention into known snapshot keys only', () => {
    expect(
      expandProfileAmendmentValues({
        intention: {
          intentionMode: 'QUESTION',
          openReading: false,
          specificQuestion: 'Que dois-je comprendre maintenant ?',
          objective: null,
        },
        birthPlace: 'Rabat, Maroc',
      }),
    ).toEqual({
      intentionMode: 'QUESTION',
      openReading: false,
      specificQuestion: 'Que dois-je comprendre maintenant ?',
      objective: null,
      birthPlace: 'Rabat, Maroc',
    });
  });
});
