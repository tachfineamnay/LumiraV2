import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import { IntakeCompletenessService } from './intake-completeness.service';
import { ProfileFieldAmendmentClientService } from './profile-field-amendment-client.service';
import { ProfileFieldAmendmentRequestService } from './profile-field-amendment-request.service';
import { ProfileFieldAmendmentReviewService } from './profile-field-amendment-review.service';
import { hashCanonicalJson } from './profile-field-amendment.shared';

const originalProfile = {
  intentionMode: 'QUESTION',
  openReading: false,
  birthDate: '1990-06-15',
  birthPlace: '',
  specificQuestion: 'Que dois-je comprendre dans cette période ?',
  objective: null,
  facePhotoUrl: 's3://onboarding/user-1/face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
  palmRole: 'PALM_RIGHT',
};

const originalProjection = {
  version: '2026-08-05-order-intake-v2',
  requirementsVersion: '2026-08-05-required-intake-v2',
  sealedAt: '2026-08-01T10:00:00.000Z',
  contentHash: 'original-hash',
  profile: originalProfile,
  assets: {
    face: { storageRef: originalProfile.facePhotoUrl },
    palm: { storageRef: originalProfile.palmPhotoUrl },
  },
};

function createPrivatePhotos() {
  return {
    validateOnboardingPhoto: jest.fn(async (storageRef: string, userId: string) => {
      if (!storageRef.startsWith(`s3://onboarding/${userId}/`)) {
        throw new BadRequestException('Référence photo invalide');
      }
      return {
        storageRef,
        key: storageRef.slice(5),
        contentType: 'image/jpeg',
        size: 100,
        etag: 'etag',
        versionId: null,
      };
    }),
    prepareForAi: jest.fn(),
  } as unknown as PrivateOnboardingPhotoService;
}

describe('generic reading intake amendments', () => {
  it('creates a request even when email delivery fails', async () => {
    const inserted = {
      id: 'ram-1',
      orderId: 'order-1',
      userId: 'user-1',
      readingIntakeId: 'intake-1',
      kind: 'PROFILE_FIELDS',
      requestedFields: ['birthPlace'],
      reason: 'Merci de préciser votre lieu de naissance.',
      status: 'REQUESTED',
      data: { previousValues: { birthPlace: null }, values: {} },
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
    };
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          userId: 'user-1',
          orderNumber: 'LUM-1',
          status: 'PAID',
          intakeRequired: true,
          clientInputs: { readingIntake: originalProjection },
          user: {
            email: 'client@example.test',
            firstName: 'Client',
            profile: null,
          },
          readingIntake: {
            id: 'intake-1',
            status: 'SEALED',
            data: originalProfile,
            contentHash: 'original-hash',
            sealedAt: new Date('2026-08-01T10:00:00.000Z'),
          },
        }),
        update: jest.fn(),
      },
      notification: { create: jest.fn() },
      $executeRaw: jest.fn(),
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([inserted]),
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const completeness = {
      assertRequestable: jest.fn().mockResolvedValue({
        fields: ['birthPlace'],
        invalidFields: [],
        result: {
          fields: [
            {
              key: 'birthPlace',
              currentValue: null,
            },
          ],
        },
      }),
    } as unknown as IntakeCompletenessService;
    const email = {
      sendOrThrow: jest.fn().mockRejectedValue(new Error('provider unavailable')),
    };
    const config = { get: jest.fn().mockReturnValue('https://oraclelumira.com') };
    const service = new ProfileFieldAmendmentRequestService(
      prisma,
      completeness,
      email as never,
      config as never,
    );

    await expect(
      service.request('order-1', 'expert-1', {
        fields: ['birthPlace'],
        reason: 'Merci de préciser votre lieu de naissance.',
      }),
    ).resolves.toMatchObject({ id: 'ram-1', status: 'REQUESTED' });

    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(email.sendOrThrow).toHaveBeenCalledTimes(1);
  });

  it('rejects arbitrary keys inside the structured intention', async () => {
    const service = new ProfileFieldAmendmentClientService(
      {} as PrismaService,
      createPrivatePhotos(),
    );

    await expect(
      service.sanitizeValues(
        'user-1',
        ['intention'],
        {
          intention: {
            intentionMode: 'QUESTION',
            openReading: false,
            specificQuestion: 'Que dois-je comprendre maintenant ?',
            admin: true,
          },
        },
        true,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves into a new complete snapshot without mutating the original intake', async () => {
    const submittedValues = { birthPlace: 'Lyon, France' };
    const submissionHash = hashCanonicalJson({
      amendmentId: 'amendment-1',
      kind: 'PROFILE_FIELDS',
      requestedFields: ['birthPlace'],
      values: submittedValues,
      faceSha256: null,
      palmSha256: null,
    });
    const amendment = {
      id: 'amendment-1',
      orderId: 'order-1',
      userId: 'user-1',
      readingIntakeId: 'intake-1',
      kind: 'PROFILE_FIELDS',
      requestedFields: ['birthPlace'],
      reason: 'Lieu manquant',
      status: 'SUBMITTED',
      data: { values: submittedValues },
      contentHash: submissionHash,
      revision: 2,
      requestedByExpertId: 'expert-1',
      requestedAt: new Date(),
      submittedAt: new Date(),
      reviewedByExpertId: null,
      reviewedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([amendment])
        .mockResolvedValueOnce([{ revision: 1 }])
        .mockResolvedValueOnce([{ ...amendment, status: 'APPROVED', revision: 3 }]),
      $executeRaw: jest.fn(),
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          userId: 'user-1',
          orderNumber: 'LUM-1',
          clientInputs: { readingIntake: originalProjection },
          readingIntake: {
            id: 'intake-1',
            status: 'SEALED',
            data: originalProfile,
            contentHash: 'original-hash',
            sealedAt: new Date('2026-08-01T10:00:00.000Z'),
          },
        }),
        update: jest.fn(),
      },
      notification: { create: jest.fn() },
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([amendment]),
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const client = new ProfileFieldAmendmentClientService(prisma, createPrivatePhotos());
    const review = new ProfileFieldAmendmentReviewService(prisma, client);

    const result = await review.approve('order-1', 'amendment-1', 'expert-1', {
      expectedRevision: 2,
    });

    expect(result.snapshot).toMatchObject({
      revision: 1,
      requirementsComplete: true,
      missingFields: [],
      invalidFields: [],
    });
    const orderUpdate = tx.order.update.mock.calls[0][0];
    expect(orderUpdate.data.clientInputs.readingIntake).toEqual(originalProjection);
    expect(orderUpdate.data.clientInputs.readingIntakeEffective).toMatchObject({
      parentContentHash: 'original-hash',
      requirementsComplete: true,
      profile: {
        birthPlace: 'Lyon, France',
        facePhotoUrl: originalProfile.facePhotoUrl,
        palmPhotoUrl: originalProfile.palmPhotoUrl,
      },
      amendmentIds: ['amendment-1'],
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });
});
