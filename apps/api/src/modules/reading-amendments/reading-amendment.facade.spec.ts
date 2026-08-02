import { ConflictException } from '@nestjs/common';
import { ReadingAmendmentFacade } from './reading-amendment.facade';

describe('ReadingAmendmentFacade', () => {
  const expert = {
    id: 'expert-1',
    email: 'expert@example.test',
    name: 'Expert',
    role: 'EXPERT',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;

  it('does not replace a submitted photo merely because its deadline passed', async () => {
    const core = { requestPalmPhoto: jest.fn() };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'ram-submitted' }]),
    };
    const facade = new ReadingAmendmentFacade(
      core as never,
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(
      facade.requestPalmPhoto('order-1', 'expert-1', {
        reason: 'Paume manquante',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(core.requestPalmPhoto).not.toHaveBeenCalled();
  });

  it('materializes a compatibility projection from a relational sealed intake before approval', async () => {
    const core = { approvePalm: jest.fn().mockResolvedValue({ status: 'APPROVED' }) };
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          clientInputs: { source: 'existing' },
          readingIntake: {
            status: 'SEALED',
            data: {
              birthDate: '1990-06-15',
              birthPlace: 'Lyon, France',
              facePhotoUrl: 's3://onboarding/user-1/face.jpg',
            },
            contentHash: 'intake-hash',
            sealedAt: new Date('2026-08-01T10:00:00.000Z'),
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const facade = new ReadingAmendmentFacade(
      core as never,
      prisma as never,
      {} as never,
      {} as never,
    );

    await facade.approvePalm('order-1', 'ram-1', 'expert-1', { expectedRevision: 2 });

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        clientInputs: {
          source: 'existing',
          readingIntake: {
            version: 'relational-reading-intake-v1',
            sealedAt: '2026-08-01T10:00:00.000Z',
            contentHash: 'intake-hash',
            profile: {
              birthDate: '1990-06-15',
              birthPlace: 'Lyon, France',
              facePhotoUrl: 's3://onboarding/user-1/face.jpg',
            },
          },
        },
      },
    });
    expect(core.approvePalm).toHaveBeenCalledWith(
      'order-1',
      'ram-1',
      'expert-1',
      { expectedRevision: 2 },
    );
  });

  it('claims the amendment before delegating revision generation', async () => {
    const core = {
      createRevisedReading: jest.fn().mockResolvedValue({ success: true }),
      listForExpert: jest.fn(),
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ revision: 8, data: {} }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      order: { findUnique: jest.fn() },
    };
    const facade = new ReadingAmendmentFacade(
      core as never,
      prisma as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(facade, 'listForExpert').mockResolvedValue([
      {
        id: 'ram-1',
        orderId: 'order-1',
        kind: 'PALM_PHOTO',
        requestedFields: ['palmPhotoUrl'],
        reason: 'Paume manquante',
        status: 'APPROVED',
        displayStatus: 'APPROVED',
        data: { revisionQueuedAt: '2026-08-02T12:00:00.000Z' },
        contentHash: 'hash',
        revision: 10,
        requestedAt: '2026-08-01T12:00:00.000Z',
        submittedAt: '2026-08-02T10:00:00.000Z',
        reviewedAt: '2026-08-02T11:00:00.000Z',
        expiresAt: '2026-08-08T12:00:00.000Z',
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-08-02T12:00:00.000Z',
      },
    ] as never);

    const result = await facade.createRevisedReading(
      'order-1',
      'ram-1',
      expert,
      { expectedRevision: 7 },
    );

    expect(core.createRevisedReading).toHaveBeenCalledWith(
      'order-1',
      'ram-1',
      expert,
      { expectedRevision: 8 },
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      amendment: { id: 'ram-1', revision: 10 },
    });
  });

  it('releases its claim when generation fails', async () => {
    const core = {
      createRevisedReading: jest.fn().mockRejectedValue(new Error('queue unavailable')),
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ revision: 4, data: {} }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const facade = new ReadingAmendmentFacade(
      core as never,
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(
      facade.createRevisedReading(
        'order-1',
        'ram-1',
        expert,
        { expectedRevision: 3 },
      ),
    ).rejects.toThrow('queue unavailable');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
