import { BadRequestException } from '@nestjs/common';
import { hashCanonicalJson } from './profile-field-amendment.shared';
import { ProfileFieldAmendmentClientService } from './profile-field-amendment-client.service';
import { ProfileFieldAmendmentRequestService } from './profile-field-amendment-request.service';
import { ProfileFieldAmendmentReviewService } from './profile-field-amendment-review.service';

function amendmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ram-1',
    orderId: 'order-1',
    userId: 'user-1',
    readingIntakeId: 'intake-1',
    kind: 'PROFILE_FIELDS',
    requestedFields: ['birthPlace'],
    reason: 'Lieu manquant',
    status: 'REQUESTED',
    data: { values: {} },
    contentHash: null,
    revision: 0,
    requestedByExpertId: 'expert-1',
    reviewedByExpertId: null,
    requestedAt: new Date('2026-08-05T10:00:00.000Z'),
    submittedAt: null,
    reviewedAt: null,
    expiresAt: new Date('2026-08-12T10:00:00.000Z'),
    createdAt: new Date('2026-08-05T10:00:00.000Z'),
    updatedAt: new Date('2026-08-05T10:00:00.000Z'),
    ...overrides,
  };
}

describe('required profile field amendments', () => {
  it('keeps a created request when email delivery fails', async () => {
    const inserted = amendmentRow();
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          userId: 'user-1',
          orderNumber: 'LUM-001',
          status: 'COMPLETED',
          clientInputs: {
            readingIntake: {
              sealedAt: '2026-08-01T10:00:00.000Z',
              contentHash: 'sealed-hash',
              profile: { birthDate: '1990-06-15', birthPlace: null },
            },
          },
          user: { email: 'client@example.test', firstName: 'Marie' },
          readingIntake: {
            id: 'intake-1',
            status: 'SEALED',
            data: {},
            contentHash: 'sealed-hash',
            sealedAt: new Date('2026-08-01T10:00:00.000Z'),
          },
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([inserted]),
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const completeness = {
      assertRequestable: jest.fn().mockResolvedValue({
        fields: ['birthPlace'],
        invalidFields: [],
        result: { fields: [{ key: 'birthPlace', displayValue: null }] },
      }),
    };
    const email = { send: jest.fn().mockRejectedValue(new Error('provider unavailable')) };
    const service = new ProfileFieldAmendmentRequestService(
      prisma as never,
      completeness as never,
      email as never,
      { get: jest.fn() } as never,
    );

    await expect(
      service.request('order-1', 'expert-1', {
        fields: ['birthPlace'],
        reason: 'Merci de préciser votre lieu de naissance.',
      }),
    ).resolves.toMatchObject({ id: 'ram-1', status: 'REQUESTED' });
    expect(tx.notification.create).toHaveBeenCalled();
    expect(email.send).toHaveBeenCalled();
  });

  it('rejects mass assignment of a field not requested by the expert', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([amendmentRow()]) };
    const privatePhotos = { validateOnboardingPhoto: jest.fn() };
    const service = new ProfileFieldAmendmentClientService(
      prisma as never,
      privatePhotos as never,
    );

    await expect(
      service.saveDraft('user-1', 'ram-1', {
        expectedRevision: 0,
        values: { birthPlace: 'Paris', rituals: 'injection interdite' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a child effective snapshot while preserving the original intake', async () => {
    const values = { birthPlace: 'Paris, France' };
    const submittedHash = hashCanonicalJson({
      amendmentId: 'ram-1',
      kind: 'PROFILE_FIELDS',
      requestedFields: ['birthPlace'],
      values,
      faceSha256: null,
      palmSha256: null,
    });
    const submitted = amendmentRow({
      status: 'SUBMITTED',
      revision: 3,
      data: { values },
      contentHash: submittedHash,
      submittedAt: new Date('2026-08-05T11:00:00.000Z'),
    });
    const approved = amendmentRow({
      ...submitted,
      status: 'APPROVED',
      revision: 4,
      reviewedAt: new Date('2026-08-05T12:00:00.000Z'),
    });
    const original = {
      version: '2026-07-20-order-intake-v1',
      sealedAt: '2026-08-01T10:00:00.000Z',
      contentHash: 'sealed-hash',
      profile: { birthDate: '1990-06-15', birthPlace: null },
      assets: {},
    };
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([submitted])
        .mockResolvedValueOnce([{ revision: 1 }])
        .mockResolvedValueOnce([approved]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          userId: 'user-1',
          orderNumber: 'LUM-001',
          clientInputs: { source: 'existing', readingIntake: original },
          readingIntake: {
            id: 'intake-1',
            status: 'SEALED',
            data: original.profile,
            contentHash: 'sealed-hash',
            sealedAt: new Date('2026-08-01T10:00:00.000Z'),
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
      notification: { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) },
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([submitted]),
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const client = {
      sanitizeValues: jest.fn().mockResolvedValue(values),
      prepareAssets: jest.fn().mockResolvedValue({ face: null, palm: null }),
    };
    const service = new ProfileFieldAmendmentReviewService(prisma as never, client as never);

    const result = await service.approve('order-1', 'ram-1', 'expert-1', {
      expectedRevision: 3,
    });

    expect(result).toMatchObject({ amendment: { status: 'APPROVED' }, snapshot: { revision: 1 } });
    const update = tx.order.update.mock.calls[0][0];
    expect(update.data.clientInputs.readingIntake).toEqual(original);
    expect(update.data.clientInputs.readingIntakeEffective).toMatchObject({
      profile: { birthDate: '1990-06-15', birthPlace: 'Paris, France' },
      parentSnapshotId: null,
      amendmentIds: ['ram-1'],
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
