import { BadRequestException } from '@nestjs/common';
import {
  normalizeRequestedProfileFields,
  parseProfileFields,
  publicProfileFields,
} from './profile-field-catalog';

describe('profile field catalog', () => {
  it('accepts only the closed requestable catalog', () => {
    expect(normalizeRequestedProfileFields(['birthDate', 'birthPlace'])).toEqual([
      'birthDate',
      'birthPlace',
    ]);
    expect(() => normalizeRequestedProfileFields(['rituals'])).toThrow(BadRequestException);
    expect(() => normalizeRequestedProfileFields(['profile.arbitrary'])).toThrow(
      BadRequestException,
    );
  });

  it('automatically couples the photographed hand with a palm request', () => {
    expect(normalizeRequestedProfileFields(['palmPhotoUrl'])).toEqual([
      'palmPhotoUrl',
      'palmRole',
    ]);
    expect(publicProfileFields(['palmPhotoUrl', 'palmRole'])).toEqual(['palmPhotoUrl']);
  });

  it('rejects a persisted hand side without a palm photo', () => {
    expect(() => parseProfileFields(['palmRole'])).toThrow(BadRequestException);
  });
});
