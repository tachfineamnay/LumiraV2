import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { readOrderIntakeReadiness } from '../expert/reading-intake-readiness';
import { PrivateOnboardingPhotoService } from '../uploads/private-onboarding-photo.service';
import { ReadingIntakeService } from './reading-intake.service';

const validDto = {
  intentionMode: 'QUESTION' as const,
  openReading: false,
  birthDate: '1990-06-15',
  birthPlace: 'Lyon, France',
  birthTime: '14:30',
  specificQuestion: 'Que dois-je comprendre maintenant ?',
  objective: undefined,
  facePhotoUrl: 's3://onboarding/user-1/face.jpg',
  palmPhotoUrl: 's3://onboarding/user-1/palm.jpg',
  palmRole: 'PALM_RIGHT' as const,
  profileCompleted: true,
  consent: { accepted: true, version: '2026-07-18-user-agency-v1' },
};

describe('ReadingIntakeService', () => {
  let service: ReadingIntakeService;
  let prisma: Record<string, any>;
  let tx: Record<string, any>;
  let privatePhotos: { validateOnboardingPhoto: jest.Mock };

  beforeEach(() => {
    tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: 'PAID',
          clientInputs: null,
        }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userProfile: {
        upsert: jest.fn().mockResolvedValue({
          id: 'profile-1',
          userId: 'user-1',
          profileCompleted: true,
        }),
      },
      consentRecord: { upsert: jest.fn().mockResolvedValue({ id: 'consent-1' }) },
      onboardingProgress: { upsert: jest.fn().mockResolvedValue({}) },
      readingIntake: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      order: { findFirst: jest.fn() },
    };
    privatePhotos = {
      validateOnboardingPhoto: jest.fn(async (storageRef: string, userId: string) => {
        if (!storageRef.startsWith(`s3://onboarding/${userId}/`)) {
          throw new BadRequestException('Référence de photo invalide');
        }
        return {
          storageRef,
          key: storageRef.replace('s3://', ''),
          contentType: 'image/jpeg',
          size: 3,
          etag: 'etag',
          versionId: null,
        };
      }),
    };
    service = new ReadingIntakeService(
      prisma as PrismaService,
      privatePhotos as unknown as PrivateOnboardingPhotoService,
    );
  });

  it('atomically snapshots the five required elements into the paid order', async () => {
    const result = await service.seal('user-1', validDto);

    expect(result.sealed).toBe(true);
    expect(privatePhotos.validateOnboardingPhoto).toHaveBeenCalledTimes(2);
    expect(tx.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          birthDate: '1990-06-15',
          birthPlace: 'Lyon, France',
          facePhotoUrl: validDto.facePhotoUrl,
          palmPhotoUrl: validDto.palmPhotoUrl,
          profileCompleted: true,
        }),
      }),
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'order-1', status: 'PAID' }),
        data: {
          clientInputs: expect.objectContaining({
            readingIntake: expect.objectContaining({
              version: '2026-08-05-order-intake-v2',
              requirementsVersion: '2026-08-05-required-intake-v2',
              sealedBy: 'CLIENT',
              contentHash: expect.any(String),
              profile: expect.objectContaining({
                intentionMode: 'QUESTION',
                openReading: false,
                specificQuestion: validDto.specificQuestion,
                facePhotoUrl: validDto.facePhotoUrl,
                palmPhotoUrl: validDto.palmPhotoUrl,
              }),
              assets: {
                face: expect.objectContaining({ storageRef: validDto.facePhotoUrl }),
                palm: expect.objectContaining({ storageRef: validDto.palmPhotoUrl }),
              },
            }),
          }),
        },
      }),
    );
  });

  it.each([
    ['intention', { intentionMode: undefined, specificQuestion: undefined }],
    ['face', { facePhotoUrl: undefined }],
    ['palm', { palmPhotoUrl: undefined }],
  ])('rejects a legacy submission without mandatory %s before writing', async (_name, patch) => {
    await expect(service.seal('user-1', { ...validDto, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(privatePhotos.validateOnboardingPhoto).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts an explicit OPEN intention', async () => {
    await expect(
      service.seal('user-1', {
        ...validDto,
        intentionMode: 'OPEN',
        openReading: true,
        specificQuestion: undefined,
        objective: undefined,
      }),
    ).resolves.toMatchObject({ sealed: true });
  });

  it('rejects contradictory explicit intention modes', async () => {
    await expect(
      service.seal('user-1', {
        ...validDto,
        intentionMode: 'OPEN',
        openReading: true,
        specificQuestion: validDto.specificQuestion,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('notifies the Desk only after the intake transaction has sealed the dossier', async () => {
    const gateway = { notifyOrderIntakeReady: jest.fn() };
    service = new ReadingIntakeService(
      prisma as PrismaService,
      privatePhotos as unknown as PrivateOnboardingPhotoService,
      gateway as never,
    );

    await service.seal('user-1', validDto);

    expect(gateway.notifyOrderIntakeReady).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', sealedAt: expect.any(String) }),
    );
  });

  it('seals the exact complete DRAFT selected by the client', async () => {
    const storedDraft = {
      id: 'intake-draft',
      userId: 'user-1',
      status: 'DRAFT',
      revision: 7,
      data: {
        schemaVersion: 3,
        intentionMode: 'QUESTION',
        birthDate: '1986-02-14',
        birthPlace: 'Rabat, Maroc',
        specificQuestion: 'Comment retrouver une direction qui me ressemble ?',
        objective: null,
        openReading: false,
        facePhoto: 's3://onboarding/user-1/face-draft.jpg',
        palmPhoto: 's3://onboarding/user-1/palm-draft.jpg',
        palmRole: 'PALM_LEFT',
        deliveryStyle: 'DOUX_ET_CLAIR',
        pace: 50,
      },
      contentHash: null,
      sealedAt: null,
    };
    const scopedOrder = {
      id: 'order-draft',
      status: 'PAID',
      clientInputs: null,
      readingIntake: storedDraft,
    };
    prisma.order.findFirst
      .mockResolvedValueOnce({ id: 'order-draft' })
      .mockResolvedValueOnce(scopedOrder);
    tx.order.findFirst.mockResolvedValueOnce({ id: 'order-draft' });
    tx.order.findUnique.mockResolvedValue(scopedOrder);

    const result = await service.seal('user-1', {
      ...validDto,
      orderId: 'order-draft',
      intakeRevision: 7,
    });

    expect(result).toMatchObject({
      sealed: true,
      orderId: 'order-draft',
      revision: 7,
      contentHash: expect.any(String),
    });
    expect(tx.readingIntake.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'intake-draft', status: 'DRAFT', revision: 7 }),
        data: expect.objectContaining({
          status: 'SEALED',
          schemaVersion: '2026-08-05-order-intake-v2',
          currentStep: 4,
          contentHash: expect.any(String),
          sealedAt: expect.any(Date),
        }),
      }),
    );
    const sealedData = tx.readingIntake.updateMany.mock.calls[0][0].data;
    expect(
      readOrderIntakeReadiness({
        intakeRequired: true,
        readingIntake: {
          status: sealedData.status,
          sealedAt: sealedData.sealedAt,
          contentHash: sealedData.contentHash,
          data: sealedData.data,
        },
      }),
    ).toMatchObject({ ready: true, status: 'SEALED', contentHash: result.contentHash });
  });

  it('rejects an order-scoped draft with no photos before the transaction', async () => {
    const storedDraft = {
      id: 'intake-draft',
      userId: 'user-1',
      status: 'DRAFT',
      revision: 7,
      data: {
        schemaVersion: 3,
        intentionMode: 'QUESTION',
        birthDate: '1986-02-14',
        birthPlace: 'Rabat, Maroc',
        specificQuestion: 'Comment retrouver une direction qui me ressemble ?',
        openReading: false,
        facePhoto: '',
        palmPhoto: '',
      },
      contentHash: null,
      sealedAt: null,
    };
    const scopedOrder = {
      id: 'order-draft',
      status: 'PAID',
      clientInputs: null,
      readingIntake: storedDraft,
    };
    prisma.order.findFirst
      .mockResolvedValueOnce({ id: 'order-draft' })
      .mockResolvedValueOnce(scopedOrder);

    await expect(
      service.seal('user-1', { ...validDto, orderId: 'order-draft', intakeRevision: 7 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires explicit consent', async () => {
    await expect(
      service.seal('user-1', {
        ...validDto,
        consent: { accepted: false, version: validDto.consent.version },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a photo reference belonging to another user', async () => {
    await expect(
      service.seal('user-1', {
        ...validDto,
        facePhotoUrl: 's3://onboarding/user-2/face.jpg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not replace an intake that has already been sealed', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      clientInputs: { readingIntake: { sealedAt: '2026-07-18T12:00:00.000Z' } },
    });

    await expect(service.seal('user-1', validDto)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userProfile.upsert).not.toHaveBeenCalled();
  });

  it('rejects a late seal after production has started', async () => {
    tx.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PROCESSING',
      clientInputs: null,
    });

    await expect(service.seal('user-1', validDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks profile edits while an active sealed reading exists', async () => {
    prisma.order.findMany = jest.fn().mockResolvedValue([
      {
        clientInputs: { readingIntake: { sealedAt: '2026-07-18T12:00:00.000Z' } },
        readingIntake: null,
      },
    ]);

    await expect(service.assertProfileEditable('user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows profile edits when there is no active sealed reading', async () => {
    prisma.order.findMany = jest.fn().mockResolvedValue([]);

    await expect(service.assertProfileEditable('user-1')).resolves.toBeUndefined();
  });
});
