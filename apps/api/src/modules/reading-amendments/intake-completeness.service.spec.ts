import { IntakeCompletenessService } from './intake-completeness.service';

const completeProfile = {
  intentionMode: 'QUESTION',
  openReading: false,
  birthDate: '1990-06-15',
  birthPlace: 'Lyon, France',
  specificQuestion: 'Que dois-je comprendre dans cette période ?',
  objective: null,
  facePhotoUrl: 's3://onboarding/user-1/face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
  palmRole: 'PALM_RIGHT',
};

function buildPrisma(input: {
  intakeRequired?: boolean;
  clientInputs?: Record<string, unknown> | null;
  readingIntake?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  active?: Array<Record<string, unknown>>;
}) {
  return {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1',
        intakeRequired: input.intakeRequired ?? true,
        clientInputs: input.clientInputs ?? null,
        readingIntake: input.readingIntake ?? null,
        user: { profile: input.profile ?? null },
      }),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue(input.active ?? []),
  };
}

describe('IntakeCompletenessService', () => {
  it('reports 5/5 for a complete sealed intake projection', async () => {
    const prisma = buildPrisma({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-08-01T10:00:00.000Z',
          contentHash: 'sealed-hash',
          profile: completeProfile,
        },
      },
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');

    expect(result).toMatchObject({
      source: 'SEALED_INTAKE',
      complete: true,
      summary: { required: 5, present: 5, missing: 0, invalid: 0 },
    });
    expect(result.fields.map((field) => field.key)).toEqual([
      'birthDate',
      'birthPlace',
      'intention',
      'facePhotoUrl',
      'palmPhotoUrl',
    ]);
    expect(result.fields.every((field) => field.required)).toBe(true);
  });

  it('marks face, palm and intention missing independently', async () => {
    const prisma = buildPrisma({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-08-01T10:00:00.000Z',
          contentHash: 'sealed-hash',
          profile: {
            birthDate: '1990-06-15',
            birthPlace: 'Lyon, France',
          },
        },
      },
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');

    expect(result.complete).toBe(false);
    expect(result.summary).toMatchObject({ required: 5, present: 2, missing: 3 });
    expect(
      result.fields
        .filter((field) => field.status === 'MISSING')
        .map((field) => field.key),
    ).toEqual(['intention', 'facePhotoUrl', 'palmPhotoUrl']);
  });

  it('prefers the approved effective snapshot over the original intake', async () => {
    const prisma = buildPrisma({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-08-01T10:00:00.000Z',
          contentHash: 'original',
          profile: { ...completeProfile, palmPhotoUrl: null },
        },
        readingIntakeEffective: {
          snapshotId: 'snapshot-2',
          contentHash: 'effective',
          effectiveAt: '2026-08-05T10:00:00.000Z',
          profile: completeProfile,
        },
      },
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');

    expect(result.source).toBe('EFFECTIVE_SNAPSHOT');
    expect(result.complete).toBe(true);
  });

  it('exposes a safe structured current intention without photo references', async () => {
    const prisma = buildPrisma({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-08-01T10:00:00.000Z',
          contentHash: 'sealed-hash',
          profile: completeProfile,
        },
      },
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');
    const intention = result.fields.find((field) => field.key === 'intention');
    const face = result.fields.find((field) => field.key === 'facePhotoUrl');

    expect(intention).toMatchObject({
      displayValue: 'Question — Que dois-je comprendre dans cette période ?',
      currentValue: {
        intentionMode: 'QUESTION',
        openReading: false,
        specificQuestion: 'Que dois-je comprendre dans cette période ?',
        objective: null,
      },
    });
    expect(face?.currentValue).toBeNull();
    expect(JSON.stringify(result)).not.toContain('s3://');
  });

  it('maps an active legacy palm request onto the mandatory palm field', async () => {
    const prisma = buildPrisma({
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-08-01T10:00:00.000Z',
          contentHash: 'sealed-hash',
          profile: { ...completeProfile, palmPhotoUrl: null },
        },
      },
      active: [
        {
          id: 'legacy-amendment',
          kind: 'PALM_PHOTO',
          requestedFields: [],
          status: 'REQUESTED',
          data: {},
        },
      ],
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');
    const palm = result.fields.find((field) => field.key === 'palmPhotoUrl');

    expect(palm).toMatchObject({
      status: 'REQUESTED',
      activeAmendmentId: 'legacy-amendment',
      requestable: false,
    });
  });

  it('falls back to a historical profile for an intakeRequired=false order', async () => {
    const prisma = buildPrisma({
      intakeRequired: false,
      profile: completeProfile,
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');

    expect(result.source).toBe('LEGACY_PROFILE');
    expect(result.complete).toBe(true);
  });
});
