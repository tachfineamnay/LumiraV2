import { ConflictException } from '@nestjs/common';
import {
  assertOrderIntakeReady,
  readOrderIntakeReadiness,
  READING_INTAKE_INCOMPLETE_CODE,
  READING_INTAKE_REQUIRED_CODE,
} from './reading-intake-readiness';

const completeData = {
  intentionMode: 'QUESTION',
  openReading: false,
  birthDate: '1990-01-01',
  birthPlace: 'Rabat',
  specificQuestion: 'Que dois-je comprendre maintenant ?',
  objective: null,
  facePhoto: 's3://onboarding/user-1/face-1.jpg',
  palmPhoto: 's3://onboarding/user-1/palm-1.jpg',
};

describe('reading intake readiness', () => {
  it('keeps legacy orders readable through the compatibility path', () => {
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
          data: completeData,
        },
      }),
    ).toMatchObject({ ready: false, status: 'INVALID' });
  });

  it('blocks a sealed intake when birthDate or birthPlace is missing', () => {
    for (const missing of ['birthDate', 'birthPlace'] as const) {
      const data = { ...completeData, [missing]: null };
      const readiness = readOrderIntakeReadiness({
        intakeRequired: true,
        readingIntake: {
          status: 'SEALED',
          sealedAt: '2026-07-20T10:00:00.000Z',
          contentHash: 'sha256:immutable',
          data,
        },
      });
      expect(readiness).toMatchObject({ ready: false, status: 'INCOMPLETE' });
      expect(readiness.missingFields).toContain(missing);
      expect(() =>
        assertOrderIntakeReady({
          intakeRequired: true,
          readingIntake: {
            status: 'SEALED',
            sealedAt: '2026-07-20T10:00:00.000Z',
            contentHash: 'sha256:immutable',
            data,
          },
        }),
      ).toThrow(ConflictException);
    }
  });

  it('blocks a sealed intake when face photo is missing', () => {
    const data = { ...completeData, facePhoto: null };
    const readiness = readOrderIntakeReadiness({
      intakeRequired: true,
      readingIntake: {
        status: 'SEALED',
        sealedAt: '2026-07-20T10:00:00.000Z',
        contentHash: 'sha256:immutable',
        data,
      },
    });
    expect(readiness).toMatchObject({ ready: false, status: 'INCOMPLETE' });
    expect(readiness.missingFields).toContain('facePhotoUrl');
  });

  it('blocks a sealed intake when palm photo is missing', () => {
    const data = { ...completeData, palmPhoto: null };
    const readiness = readOrderIntakeReadiness({
      intakeRequired: true,
      readingIntake: {
        status: 'SEALED',
        sealedAt: '2026-07-20T10:00:00.000Z',
        contentHash: 'sha256:immutable',
        data,
      },
    });
    expect(readiness).toMatchObject({ ready: false, status: 'INCOMPLETE' });
    expect(readiness.missingFields).toContain('palmPhotoUrl');
  });

  it('blocks a sealed intake without a valid intention', () => {
    const readiness = readOrderIntakeReadiness({
      intakeRequired: true,
      readingIntake: {
        status: 'SEALED',
        sealedAt: '2026-07-20T10:00:00.000Z',
        contentHash: 'sha256:immutable',
        data: {
          ...completeData,
          intentionMode: null,
          specificQuestion: null,
          objective: null,
          openReading: false,
        },
      },
    });
    expect(readiness).toMatchObject({ ready: false, status: 'INCOMPLETE' });
    expect(readiness.missingFields).toContain('intention');
  });

  it('allows generation when all 5 elements are complete', () => {
    const order = {
      intakeRequired: true,
      readingIntake: {
        status: 'SEALED',
        sealedAt: '2026-07-20T10:00:00.000Z',
        contentHash: 'sha256:immutable',
        data: completeData,
      },
    };

    expect(readOrderIntakeReadiness(order)).toMatchObject({
      required: true,
      ready: true,
      status: 'SEALED',
      contentHash: 'sha256:immutable',
      missingFields: [],
      invalidFields: [],
    });
    expect(() => assertOrderIntakeReady(order)).not.toThrow();
  });

  it('photo streaming changes do not affect or alter the production readiness guard', () => {
    const order = {
      intakeRequired: true,
      readingIntake: {
        status: 'DRAFT',
        data: { birthDate: '1990-01-01' },
      },
    };

    expect(() => assertOrderIntakeReady(order)).toThrow(ConflictException);
  });

  it('exposes the existing code for an unsealed intake', () => {
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

  it('exposes the incomplete code and missing fields for a sealed dossier', () => {
    try {
      assertOrderIntakeReady({
        intakeRequired: true,
        readingIntake: {
          status: 'SEALED',
          sealedAt: '2026-07-20T10:00:00.000Z',
          contentHash: 'sha256:immutable',
          data: { birthDate: '1990-01-01', birthPlace: 'Rabat' },
        },
      });
      throw new Error('Expected readiness guard to throw');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: READING_INTAKE_INCOMPLETE_CODE,
        intakeStatus: 'INCOMPLETE',
        missingFields: expect.arrayContaining(['intention', 'facePhotoUrl', 'palmPhotoUrl']),
      });
    }
  });
});
