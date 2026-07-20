import { ConflictException } from '@nestjs/common';
import {
  assertOrderIntakeReady,
  readOrderIntakeReadiness,
  READING_INTAKE_REQUIRED_CODE,
} from './reading-intake-readiness';

describe('reading intake readiness', () => {
  it('keeps legacy orders compatible', () => {
    expect(readOrderIntakeReadiness({ intakeRequired: false })).toMatchObject({
      required: false,
      ready: true,
      status: 'LEGACY',
    });
  });

  it('blocks a required order without a sealed intake', () => {
    const order = {
      intakeRequired: true,
      readingIntake: { status: 'DRAFT', data: { birthDate: '1990-01-01' } },
    };

    expect(readOrderIntakeReadiness(order)).toMatchObject({
      required: true,
      ready: false,
      status: 'DRAFT',
    });
    expect(() => assertOrderIntakeReady(order)).toThrow(ConflictException);
  });

  it('rejects a nominally sealed intake without its immutable hash', () => {
    expect(
      readOrderIntakeReadiness({
        intakeRequired: true,
        readingIntake: {
          status: 'SEALED',
          sealedAt: new Date('2026-07-20T10:00:00.000Z'),
          contentHash: null,
          data: { birthDate: '1990-01-01', birthPlace: 'Rabat' },
        },
      }),
    ).toMatchObject({ ready: false, status: 'INVALID' });
  });

  it('accepts a complete sealed order-scoped intake', () => {
    const order = {
      intakeRequired: true,
      readingIntake: {
        status: 'SEALED',
        sealedAt: '2026-07-20T10:00:00.000Z',
        contentHash: 'sha256:immutable',
        data: { birthDate: '1990-01-01', birthPlace: 'Rabat' },
      },
    };

    expect(readOrderIntakeReadiness(order)).toMatchObject({
      required: true,
      ready: true,
      status: 'SEALED',
      contentHash: 'sha256:immutable',
    });
    expect(() => assertOrderIntakeReady(order)).not.toThrow();
  });

  it('exposes a stable application error code', () => {
    try {
      assertOrderIntakeReady({ intakeRequired: true, readingIntake: null });
      throw new Error('Expected readiness guard to throw');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: READING_INTAKE_REQUIRED_CODE,
        intakeStatus: 'MISSING',
      });
    }
  });
});
