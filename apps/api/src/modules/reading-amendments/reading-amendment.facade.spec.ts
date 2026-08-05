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

  function createFacade(input: {
    core?: Record<string, jest.Mock>;
    profileFields?: Record<string, jest.Mock>;
    completeness?: Record<string, jest.Mock>;
    prisma?: Record<string, unknown>;
    email?: Record<string, jest.Mock>;
  }) {
    return new ReadingAmendmentFacade(
      (input.core ?? {}) as never,
      (input.profileFields ?? {}) as never,
      (input.completeness ?? {}) as never,
      (input.prisma ?? {}) as never,
      (input.email ?? {}) as never,
      { get: jest.fn() } as never,
    );
  }

  it('does not create a second request while any complement is active', async () => {
    const core = { requestPalmPhoto: jest.fn() };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'COMPLETED',
          orderNumber: 'LUM-001',
          user: { email: 'client@example.test', firstName: 'Marie' },
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        { id: 'ram-submitted', kind: 'PROFILE_FIELDS', status: 'SUBMITTED' },
      ]),
    };
    const facade = createFacade({ core, prisma });

    await expect(
      facade.requestPalmPhoto('order-1', 'expert-1', {
        reason: 'Paume manquante',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(core.requestPalmPhoto).not.toHaveBeenCalled();
  });

  it('rejects a legacy palm request for an order that cannot enter revision', async () => {
    const core = { requestPalmPhoto: jest.fn() };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'FAILED',
          orderNumber: 'LUM-002',
          user: { email: 'client@example.test', firstName: 'Marie' },
        }),
      },
      $queryRaw: jest.fn(),
    };
    const facade = createFacade({ core, prisma });

    await expect(
      facade.requestPalmPhoto('order-failed', 'expert-1', {
        reason: 'Paume manquante',
      }),
    ).rejects.toThrow('FAILED');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(core.requestPalmPhoto).not.toHaveBeenCalled();
  });

  it('dispatches a client draft by the persisted amendment kind', async () => {
    const profileFields = { saveDraft: jest.fn().mockResolvedValue({ status: 'DRAFT' }) };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ kind: 'PROFILE_FIELDS' }]),
    };
    const facade = createFacade({ profileFields, prisma });

    await facade.saveDraft('user-1', 'ram-1', {
      expectedRevision: 2,
      values: { birthPlace: 'Paris, France' },
    });

    expect(profileFields.saveDraft).toHaveBeenCalledWith('user-1', 'ram-1', {
      expectedRevision: 2,
      values: { birthPlace: 'Paris, France' },
    });
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
              facePhoto: 's3://onboarding/user-1/face.jpg',
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
      $queryRaw: jest.fn().mockResolvedValue([{ kind: 'PALM_PHOTO' }]),
    };
    const facade = createFacade({ core, prisma });

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
              facePhoto: 's3://onboarding/user-1/face.jpg',
              facePhotoUrl: 's3://onboarding/user-1/face.jpg',
              palmPhotoUrl: null,
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
    };
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ kind: 'PALM_PHOTO' }])
        .mockResolvedValueOnce([{ revision: 8, data: {} }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const facade = createFacade({ core, prisma });
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
    expect(result).toMatchObject({ success: true, amendment: { id: 'ram-1', revision: 10 } });
  });

  it('releases its revision claim when generation fails', async () => {
    const core = {
      createRevisedReading: jest.fn().mockRejectedValue(new Error('queue unavailable')),
    };
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ kind: 'PALM_PHOTO' }])
        .mockResolvedValueOnce([{ revision: 4, data: {} }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const facade = createFacade({ core, prisma });

    await expect(
      facade.createRevisedReading('order-1', 'ram-1', expert, { expectedRevision: 3 }),
    ).rejects.toThrow('queue unavailable');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
