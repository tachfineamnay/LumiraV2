import { BadRequestException, ConflictException } from '@nestjs/common';
import { IntakeCompletenessService } from './intake-completeness.service';

function buildPrisma(options?: {
  order?: Record<string, unknown>;
  amendments?: Array<Record<string, unknown>>;
}) {
  return {
    order: {
      findUnique: jest.fn().mockResolvedValue(
        options?.order ?? {
          id: 'order-1',
          intakeRequired: true,
          clientInputs: {
            readingIntake: {
              sealedAt: '2026-08-01T10:00:00.000Z',
              contentHash: 'sealed-hash',
              profile: {
                openReading: false,
                birthDate: '1990-06-15',
                birthPlace: 'Lyon, France',
                objective: null,
                specificQuestion: null,
                facePhotoUrl: null,
                palmPhotoUrl: null,
              },
            },
          },
          readingIntake: null,
          user: { profile: null },
        },
      ),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue(options?.amendments ?? []),
  };
}

describe('IntakeCompletenessService', () => {
  it('prefers the approved effective snapshot and never exposes private photo refs', async () => {
    const prisma = buildPrisma({
      order: {
        id: 'order-1',
        intakeRequired: true,
        clientInputs: {
          readingIntake: {
            sealedAt: '2026-08-01T10:00:00.000Z',
            contentHash: 'sealed-hash',
            profile: { birthDate: '1990-06-15', birthPlace: 'Lyon, France' },
          },
          readingIntakeEffective: {
            snapshotId: 'ris-1',
            contentHash: 'effective-hash',
            profile: {
              openReading: true,
              birthDate: '1991-02-03',
              birthPlace: 'Paris, France',
              facePhotoUrl: 's3://onboarding/user-1/face.jpg',
              palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
            },
          },
        },
        readingIntake: null,
        user: { profile: null },
      },
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');

    expect(result.source).toBe('EFFECTIVE_SNAPSHOT');
    expect(result.complete).toBe(true);
    expect(result.summary).toMatchObject({ required: 2, present: 2, missing: 0 });
    expect(result.fields.find((field) => field.key === 'birthDate')?.displayValue).toBe(
      '1991-02-03',
    );
    expect(result.fields.find((field) => field.key === 'facePhotoUrl')).toMatchObject({
      required: false,
      status: 'PRESENT',
      hasValue: true,
      displayValue: null,
      requestable: true,
    });
    expect(result.fields.find((field) => field.key === 'specificQuestion')).toMatchObject({
      required: false,
      status: 'OPTIONAL',
      requestable: false,
    });
    expect(JSON.stringify(result)).not.toContain('s3://');
  });

  it('requires a question when the reading is not open and no objective exists', async () => {
    const prisma = buildPrisma();
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');

    expect(result.fields.map((field) => field.key)).toEqual([
      'birthDate',
      'birthPlace',
      'specificQuestion',
      'facePhotoUrl',
      'palmPhotoUrl',
    ]);
    expect(result.summary).toMatchObject({ required: 3, present: 2, missing: 1 });
    expect(result.fields.find((field) => field.key === 'facePhotoUrl')).toMatchObject({
      required: false,
      status: 'OPTIONAL',
      requestable: true,
    });
    expect(result.complete).toBe(false);
  });

  it('promotes an optional palm photo to required while the expert request is active', async () => {
    const prisma = buildPrisma({
      amendments: [
        {
          id: 'ram-palm',
          kind: 'PALM_PHOTO',
          requestedFields: ['palmPhotoUrl', 'palmRole'],
          status: 'SUBMITTED',
          data: {},
        },
      ],
    });
    const service = new IntakeCompletenessService(prisma as never);

    const result = await service.getForOrder('order-1');

    expect(result.fields.find((field) => field.key === 'palmPhotoUrl')).toMatchObject({
      required: true,
      status: 'SUBMITTED',
      activeAmendmentId: 'ram-palm',
      requestable: false,
    });
    expect(result.complete).toBe(false);
  });

  it('allows an expert to request a missing optional photo', async () => {
    const prisma = buildPrisma();
    const service = new IntakeCompletenessService(prisma as never);

    await expect(service.assertRequestable('order-1', ['facePhotoUrl'])).resolves.toMatchObject({
      fields: ['facePhotoUrl'],
      invalidFields: [],
    });
  });

  it('rejects a present value unless the expert explicitly marks it unusable', async () => {
    const prisma = buildPrisma();
    const service = new IntakeCompletenessService(prisma as never);

    await expect(service.assertRequestable('order-1', ['birthDate'])).rejects.toBeInstanceOf(
      ConflictException,
    );

    await expect(
      service.assertRequestable('order-1', ['birthDate'], ['birthDate']),
    ).resolves.toMatchObject({ fields: ['birthDate'], invalidFields: ['birthDate'] });
  });

  it('rejects a redundant question when an objective already satisfies the intention', async () => {
    const prisma = buildPrisma({
      order: {
        id: 'order-1',
        intakeRequired: true,
        clientInputs: {
          readingIntake: {
            sealedAt: '2026-08-01T10:00:00.000Z',
            contentHash: 'sealed-hash',
            profile: {
              openReading: false,
              birthDate: '1990-06-15',
              birthPlace: 'Lyon, France',
              objective: 'Faire le point sur ma transition professionnelle',
              specificQuestion: null,
            },
          },
        },
        readingIntake: null,
        user: { profile: null },
      },
    });
    const service = new IntakeCompletenessService(prisma as never);

    await expect(
      service.assertRequestable('order-1', ['specificQuestion']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid marker that is not part of the request', async () => {
    const prisma = buildPrisma();
    const service = new IntakeCompletenessService(prisma as never);

    await expect(
      service.assertRequestable('order-1', ['facePhotoUrl'], ['birthDate']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
