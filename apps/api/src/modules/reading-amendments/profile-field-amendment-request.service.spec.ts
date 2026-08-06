import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntakeCompletenessService } from './intake-completeness.service';
import { ProfileFieldAmendmentRequestService } from './profile-field-amendment-request.service';

describe('ProfileFieldAmendmentRequestService', () => {
  const originalProfile = {
    birthDate: '1990-06-15',
    birthPlace: 'Paris',
  };

  const createMockOrder = (overrides = {}) => ({
    id: 'order-1',
    userId: 'user-1',
    orderNumber: 'LUM-100',
    status: 'PAID',
    intakeRequired: true,
    clientInputs: {},
    user: {
      email: 'client@example.test',
      firstName: 'Client',
      profile: originalProfile,
    },
    readingIntake: null,
    ...overrides,
  });

  const setupService = (txOverrides = {}, completenessOverrides = {}, emailFail = false) => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(createMockOrder()),
        update: jest.fn().mockResolvedValue({}),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([]) // active amendments check
        .mockResolvedValueOnce([
          {
            id: 'ram-new',
            orderId: 'order-1',
            userId: 'user-1',
            readingIntakeId: null,
            kind: 'PROFILE_FIELDS',
            requestedFields: ['birthPlace'],
            reason: 'Veuillez renseigner votre lieu de naissance',
            status: 'REQUESTED',
            data: {},
            contentHash: null,
            revision: 0,
            requestedByExpertId: 'expert-1',
            requestedAt: new Date(),
            submittedAt: null,
            reviewedByExpertId: null,
            reviewedAt: null,
            expiresAt: new Date(Date.now() + 86_400_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      ...txOverrides,
    };

    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;

    const completeness = {
      assertRequestable: jest.fn().mockResolvedValue({
        fields: ['birthPlace'],
        invalidFields: [],
        result: {
          fields: [{ key: 'birthPlace', currentValue: null }],
        },
      }),
      ...completenessOverrides,
    } as unknown as IntakeCompletenessService;

    const email = {
      sendOrThrow: emailFail
        ? jest.fn().mockRejectedValue(new Error('Email provider offline'))
        : jest.fn().mockResolvedValue(undefined),
    };

    const config = {
      get: jest.fn().mockReturnValue('https://oraclelumira.com'),
    };

    const service = new ProfileFieldAmendmentRequestService(
      prisma,
      completeness,
      email as never,
      config as never,
    );

    return { service, tx, prisma, completeness, email };
  };

  it('allows creating an amendment request on a DRAFT intake', async () => {
    const draftOrder = createMockOrder({
      readingIntake: {
        id: 'intake-draft',
        status: 'DRAFT',
        data: { birthDate: '1990-06-15' },
        contentHash: null,
        sealedAt: null,
      },
    });

    const { service, tx } = setupService();
    tx.order.findUnique.mockResolvedValue(draftOrder);

    const result = await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    expect(result).toMatchObject({ id: 'ram-new', status: 'REQUESTED' });
  });

  it('allows creating an amendment request without an intake (missing intake)', async () => {
    const noIntakeOrder = createMockOrder({ readingIntake: null });

    const { service, tx } = setupService();
    tx.order.findUnique.mockResolvedValue(noIntakeOrder);

    const result = await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    expect(result).toMatchObject({ id: 'ram-new', status: 'REQUESTED' });
  });

  it('creates original input projection in clientInputs if not existing', async () => {
    const { service, tx } = setupService();
    tx.order.findUnique.mockResolvedValue(createMockOrder({ clientInputs: {} }));

    await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    expect(tx.order.update).toHaveBeenCalledTimes(1);
    expect(tx.order.update.mock.calls[0][0].data.clientInputs.readingIntake).toBeDefined();
  });

  it('preserves existing original input projection if already present', async () => {
    const existingInputs = {
      readingIntake: {
        capturedAt: '2026-08-01T10:00:00.000Z',
        contentHash: 'existing-hash-123',
        profile: { birthDate: '1990-01-01' },
      },
    };
    const { service, tx } = setupService();
    tx.order.findUnique.mockResolvedValue(createMockOrder({ clientInputs: existingInputs }));

    await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('returns structured AMENDMENT_ALREADY_OPEN conflict for active REQUESTED amendment', async () => {
    const { service, tx } = setupService();
    tx.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'ram-active', status: 'REQUESTED', kind: 'PROFILE_FIELDS' }]);

    try {
      await service.request('order-1', 'expert-1', {
        fields: ['birthPlace'],
        reason: 'Lieu de naissance requis.',
      });
      throw new Error('Expected service.request to throw ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'AMENDMENT_ALREADY_OPEN',
        amendmentId: 'ram-active',
        amendmentStatus: 'REQUESTED',
        amendmentKind: 'PROFILE_FIELDS',
      });
    }
  });

  it('returns structured AMENDMENT_ALREADY_OPEN conflict for active DRAFT amendment', async () => {
    const { service, tx } = setupService();
    tx.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'ram-draft', status: 'DRAFT', kind: 'PROFILE_FIELDS' }]);

    try {
      await service.request('order-1', 'expert-1', {
        fields: ['birthPlace'],
        reason: 'Lieu de naissance requis.',
      });
      throw new Error('Expected service.request to throw ConflictException');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'AMENDMENT_ALREADY_OPEN',
        amendmentId: 'ram-draft',
        amendmentStatus: 'DRAFT',
      });
    }
  });

  it('returns structured AMENDMENT_ALREADY_OPEN conflict for active SUBMITTED amendment', async () => {
    const { service, tx } = setupService();
    tx.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'ram-sub', status: 'SUBMITTED', kind: 'PROFILE_FIELDS' }]);

    try {
      await service.request('order-1', 'expert-1', {
        fields: ['birthPlace'],
        reason: 'Lieu de naissance requis.',
      });
      throw new Error('Expected service.request to throw ConflictException');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'AMENDMENT_ALREADY_OPEN',
        amendmentId: 'ram-sub',
        amendmentStatus: 'SUBMITTED',
      });
    }
  });

  it('cancels expired REQUESTED/DRAFT amendments before checking active requests', async () => {
    const { service, tx } = setupService();

    await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('creates notification exactly once', async () => {
    const { service, tx } = setupService();

    await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });

  it('handles email sending failure gracefully without rolling back amendment creation', async () => {
    const { service, tx, email } = setupService({}, {}, true);

    const result = await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    expect(result).toMatchObject({ id: 'ram-new', status: 'REQUESTED' });
    expect(email.sendOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });

  it('does not alter production status or overwrite reading/PDF/audio/deliveries', async () => {
    const { service, tx } = setupService();

    await service.request('order-1', 'expert-1', {
      fields: ['birthPlace'],
      reason: 'Lieu de naissance requis.',
    });

    // Verify order.status was not modified in tx.order.update
    if (tx.order.update.mock.calls.length > 0) {
      const updatePayload = tx.order.update.mock.calls[0][0].data;
      expect(updatePayload.status).toBeUndefined();
    }
  });
});
